#!/usr/bin/env node
// Creates the Bryntum publisher, the BryntumGanttTrial solution and the two Dataverse
// tables the Gantt component uses, through the Dataverse Web API. Idempotent: re-running
// it only adds what is missing. Optionally seeds the sample project.
//
//   node scripts/provision-dataverse.mjs --url https://orgXXXX.crm4.dynamics.com [--seed] [--tenant <tenant id or domain>]
//
// Sign-in uses the device-code flow with the public Power Platform CLI app id, so no app
// registration is needed. You need the System Administrator or System Customizer role.
//
// After it finishes:
//   pac pcf push --publisher-prefix bryntum --solution-unique-name BryntumGanttTrial --environment <url>
//   bash scripts/export-solution.sh <url>

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));

const orgUrl = (args.url || process.env.DATAVERSE_URL || '').replace(/\/+$/, '');
if (!orgUrl) {
    console.error('Usage: node scripts/provision-dataverse.mjs --url https://orgXXXX.crmN.dynamics.com [--seed] [--tenant <id>]');
    process.exit(2);
}
const tenant = args.tenant || process.env.DATAVERSE_TENANT_ID || 'organizations';
const clientId = process.env.DATAVERSE_CLIENT_ID || '51f81489-12ee-4a9e-aaae-a2591f45987d'; // Power Platform CLI public client
const apiRoot = `${orgUrl}/api/data/v9.2`;

// ---------------------------------------------------------------------------
// Schema. Keep in sync with code/bryntum-gantt-pcf/BryntumGantt/constants.ts
// ---------------------------------------------------------------------------
const PREFIX = 'bryntum';
const SOLUTION = { uniqueName : 'BryntumGanttTrial', friendlyName : 'Bryntum Gantt (trial)', version : '1.0.0.0' };
const PUBLISHER = { uniqueName : 'Bryntum', friendlyName : 'Bryntum', prefix : PREFIX, optionValuePrefix : 68162 };

const TASKS = {
    logicalName    : `${PREFIX}_bryntumgantttask`,
    schemaName     : `${PREFIX}_BryntumGanttTask`,
    displayName    : 'Bryntum Gantt Task',
    collectionName : 'Bryntum Gantt Tasks',
    primaryName    : { schemaName : `${PREFIX}_Name`, displayName : 'Name', maxLength : 200 },
    description    : 'Tasks shown in the Bryntum Gantt component. One row per task; parentid links sub-tasks to their summary task.'
};
const DEPENDENCIES = {
    logicalName    : `${PREFIX}_bryntumganttdependency`,
    schemaName     : `${PREFIX}_BryntumGanttDependency`,
    displayName    : 'Bryntum Gantt Dependency',
    collectionName : 'Bryntum Gantt Dependencies',
    primaryName    : { schemaName : `${PREFIX}_Name`, displayName : 'Name', maxLength : 100 },
    description    : 'Links between two Bryntum Gantt Tasks (predecessor "from", successor "to").'
};

const text = (schema, display, maxLength = 100) => ['string', schema, display, { maxLength }];
const int = (schema, display, min = -2147483648, max = 2147483647) => ['integer', schema, display, { min, max }];
const bit = (schema, display) => int(schema, display, 0, 1);
const dbl = (schema, display, min = -100000000000, max = 100000000000) => ['double', schema, display, { min, max, precision : 2 }];
const date = (schema, display) => ['datetime', schema, display];

const TASK_COLUMNS = [
    date(`${PREFIX}_StartDate`, 'Start date'),
    date(`${PREFIX}_EndDate`, 'End date'),
    dbl(`${PREFIX}_Effort`, 'Effort'),
    text(`${PREFIX}_EffortUnit`, 'Effort unit'),
    dbl(`${PREFIX}_Duration`, 'Duration'),
    text(`${PREFIX}_DurationUnit`, 'Duration unit'),
    dbl(`${PREFIX}_PercentDone`, 'Percent done', 0, 100),
    text(`${PREFIX}_SchedulingMode`, 'Scheduling mode'),
    ['memo', `${PREFIX}_Note`, 'Note', { maxLength : 4000 }],
    text(`${PREFIX}_ConstraintType`, 'Constraint type'),
    date(`${PREFIX}_ConstraintDate`, 'Constraint date'),
    bit(`${PREFIX}_ManuallyScheduled`, 'Manually scheduled'),
    bit(`${PREFIX}_Unscheduled`, 'Unscheduled'),
    bit(`${PREFIX}_IgnoreResourceCalendar`, 'Ignore resource calendar'),
    bit(`${PREFIX}_EffortDriven`, 'Effort driven'),
    bit(`${PREFIX}_Inactive`, 'Inactive'),
    text(`${PREFIX}_Cls`, 'CSS class'),
    text(`${PREFIX}_IconCls`, 'Icon CSS class'),
    text(`${PREFIX}_Color`, 'Color'),
    bit(`${PREFIX}_Expanded`, 'Expanded'),
    date(`${PREFIX}_Deadline`, 'Deadline'),
    text(`${PREFIX}_Direction`, 'Direction'),
    text(`${PREFIX}_ParentId`, 'Parent task id'),
    int(`${PREFIX}_ParentIndex`, 'Parent index'),
    int(`${PREFIX}_OrderedParentIndex`, 'Ordered parent index')
];

const DEPENDENCY_COLUMNS = [
    int(`${PREFIX}_Type`, 'Type'),
    text(`${PREFIX}_Cls`, 'CSS class'),
    dbl(`${PREFIX}_Lag`, 'Lag'),
    text(`${PREFIX}_LagUnit`, 'Lag unit'),
    bit(`${PREFIX}_Active`, 'Active'),
    text(`${PREFIX}_FromSide`, 'From side'),
    text(`${PREFIX}_ToSide`, 'To side')
];

const LOOKUPS = [
    { schemaName : `${PREFIX}_BryntumGanttTask_Dependency_From`, lookupSchemaName : `${PREFIX}_From`, navigation : `${PREFIX}_from`, displayName : 'From task' },
    { schemaName : `${PREFIX}_BryntumGanttTask_Dependency_To`, lookupSchemaName : `${PREFIX}_To`, navigation : `${PREFIX}_to`, displayName : 'To task' }
];

main().catch(error => {
    const details = error?.details ? `\n${JSON.stringify(error.details, null, 2)}` : '';
    console.error(`\nProvisioning failed: ${error.message}${details}`);
    process.exit(1);
});

async function main() {
    console.log(`Target Dataverse organization: ${orgUrl}`);
    const token = await acquireDeviceCodeToken();
    const who = await dv(token, 'GET', 'WhoAmI()');
    console.log(`Connected. UserId ${who.UserId}, OrganizationId ${who.OrganizationId}`);

    await ensurePublisher(token);
    await ensureSolution(token);

    const sol = { 'MSCRM.SolutionUniqueName' : SOLUTION.uniqueName };
    await ensureTable(token, TASKS, sol);
    await ensureTable(token, DEPENDENCIES, sol);
    for (const col of TASK_COLUMNS) await ensureColumn(token, TASKS.logicalName, col, sol);
    for (const col of DEPENDENCY_COLUMNS) await ensureColumn(token, DEPENDENCIES.logicalName, col, sol);
    for (const lookup of LOOKUPS) await ensureLookup(token, lookup, sol);

    console.log('Publishing customizations…');
    await dv(token, 'POST', 'PublishAllXml', {});
    await wait(8000);

    const t = await dv(token, 'GET', `EntityDefinitions(LogicalName='${TASKS.logicalName}')?$select=EntitySetName,PrimaryIdAttribute`);
    const d = await dv(token, 'GET', `EntityDefinitions(LogicalName='${DEPENDENCIES.logicalName}')?$select=EntitySetName,PrimaryIdAttribute`);
    console.log(`Tasks:        ${TASKS.logicalName}  set=${t.EntitySetName}  id=${t.PrimaryIdAttribute}`);
    console.log(`Dependencies: ${DEPENDENCIES.logicalName}  set=${d.EntitySetName}  id=${d.PrimaryIdAttribute}`);
    if (t.EntitySetName !== `${PREFIX}_bryntumgantttasks` || d.EntitySetName !== `${PREFIX}_bryntumganttdependencies`) {
        console.warn('WARNING: entity set names differ from constants.ts. The component resolves them at runtime, but update constants.ts to match.');
    }

    if (args.seed) {
        await seed(token, t.EntitySetName, d.EntitySetName, t.PrimaryIdAttribute);
    }
    console.log('\nDone. Next: pac pcf push --publisher-prefix bryntum --solution-unique-name BryntumGanttTrial --environment ' + orgUrl);
}

// ---------------------------------------------------------------------------
// Publisher and solution
// ---------------------------------------------------------------------------
async function ensurePublisher(token) {
    const existing = await dv(token, 'GET', `publishers?$select=publisherid,customizationprefix&$filter=uniquename eq '${PUBLISHER.uniqueName}'`);
    if (existing.value.length) {
        if (existing.value[0].customizationprefix !== PUBLISHER.prefix) {
            throw new Error(`Publisher ${PUBLISHER.uniqueName} exists with prefix "${existing.value[0].customizationprefix}", expected "${PUBLISHER.prefix}".`);
        }
        console.log(`Publisher exists: ${PUBLISHER.uniqueName} (${PUBLISHER.prefix})`);
        return;
    }
    const byPrefix = await dv(token, 'GET', `publishers?$select=uniquename&$filter=customizationprefix eq '${PUBLISHER.prefix}'`);
    if (byPrefix.value.length) {
        throw new Error(`Prefix "${PUBLISHER.prefix}" is already used by publisher ${byPrefix.value[0].uniquename}.`);
    }
    console.log(`Creating publisher ${PUBLISHER.uniqueName}`);
    await dv(token, 'POST', 'publishers', {
        uniquename                     : PUBLISHER.uniqueName,
        friendlyname                   : PUBLISHER.friendlyName,
        customizationprefix            : PUBLISHER.prefix,
        customizationoptionvalueprefix : PUBLISHER.optionValuePrefix,
        description                    : 'Bryntum AB, makers of the Bryntum Gantt.',
        emailaddress                   : 'sales@bryntum.com',
        supportingwebsiteurl           : 'https://bryntum.com'
    });
}

async function ensureSolution(token) {
    const existing = await dv(token, 'GET', `solutions?$select=solutionid&$filter=uniquename eq '${SOLUTION.uniqueName}'`);
    if (existing.value.length) {
        console.log(`Solution exists: ${SOLUTION.uniqueName}`);
        return;
    }
    const pub = await dv(token, 'GET', `publishers?$select=publisherid&$filter=uniquename eq '${PUBLISHER.uniqueName}'`);
    console.log(`Creating solution ${SOLUTION.uniqueName}`);
    await dv(token, 'POST', 'solutions', {
        uniquename                     : SOLUTION.uniqueName,
        friendlyname                   : SOLUTION.friendlyName,
        version                        : SOLUTION.version,
        description                    : 'Bryntum Gantt trial as a Power Apps code component, with its Dataverse tables.',
        'publisherid@odata.bind'       : `/publishers(${pub.value[0].publisherid})`
    });
}

// ---------------------------------------------------------------------------
// Tables, columns, lookups
// ---------------------------------------------------------------------------
async function ensureTable(token, table, headers) {
    const existing = await rawDv(token, 'GET', `EntityDefinitions(LogicalName='${table.logicalName}')?$select=LogicalName`, undefined, { okStatuses : [200, 404] });
    if (existing.status === 200) {
        console.log(`Table exists: ${table.logicalName}`);
        await addExistingTableToSolution(token, table.logicalName);
        return;
    }
    console.log(`Creating table: ${table.logicalName}`);
    await dv(token, 'POST', 'EntityDefinitions', {
        '@odata.type'         : 'Microsoft.Dynamics.CRM.EntityMetadata',
        SchemaName            : table.schemaName,
        DisplayName           : label(table.displayName),
        DisplayCollectionName : label(table.collectionName),
        Description           : label(table.description),
        OwnershipType         : 'UserOwned',
        IsActivity            : false,
        HasActivities         : false,
        HasNotes              : false,
        Attributes            : [stringAttribute(table.primaryName.schemaName, table.primaryName.displayName, { maxLength : table.primaryName.maxLength, isPrimaryName : true })]
    }, { headers });
    await waitFor(() => rawDv(token, 'GET', `EntityDefinitions(LogicalName='${table.logicalName}')?$select=LogicalName`, undefined, { okStatuses : [200, 404] }).then(r => r.status === 200), `table ${table.logicalName}`);
}

async function addExistingTableToSolution(token, logicalName) {
    // Makes re-runs against an environment that already has the tables (for example one
    // provisioned by hand) still produce a complete solution.
    const meta = await dv(token, 'GET', `EntityDefinitions(LogicalName='${logicalName}')?$select=MetadataId`);
    await rawDv(token, 'POST', 'AddSolutionComponent', {
        ComponentId                     : meta.MetadataId,
        ComponentType                   : 1, // Entity
        SolutionUniqueName              : SOLUTION.uniqueName,
        AddRequiredComponents           : false,
        DoNotIncludeSubcomponents       : false,
        IncludedComponentSettingsValues : null
    }, { okStatuses : [200, 204, 400] });
}

async function ensureColumn(token, entityLogicalName, [kind, schemaName, displayName, options = {}], headers) {
    const logicalName = schemaName.toLowerCase();
    if (await attributeExists(token, entityLogicalName, logicalName)) {
        console.log(`Column exists: ${entityLogicalName}.${logicalName}`);
        return;
    }
    console.log(`Creating column: ${entityLogicalName}.${logicalName}`);
    await dv(token, 'POST', `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`, attribute(kind, schemaName, displayName, options), { headers });
    await waitFor(() => attributeExists(token, entityLogicalName, logicalName), `${entityLogicalName}.${logicalName}`);
}

async function ensureLookup(token, lookup, headers) {
    const existing = await dv(token, 'GET', `RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?$select=SchemaName,MetadataId,CascadeConfiguration&$filter=SchemaName eq '${lookup.schemaName}'`);
    if (existing.value.length) {
        const rel = existing.value[0];
        if (rel.CascadeConfiguration?.Delete === 'RemoveLink') {
            console.log(`Lookup exists: ${lookup.schemaName}`);
            return;
        }
        // An earlier version of this script created the lookup as a parental (cascade delete)
        // relationship. Dataverse allows only one of those per child table, so the second lookup
        // failed. Recreate it as referential. Safe: no dependency rows exist until the seed runs.
        console.log(`Recreating lookup ${lookup.schemaName} as referential (was ${rel.CascadeConfiguration?.Delete})`);
        await rawDv(token, 'DELETE', `RelationshipDefinitions(${rel.MetadataId})`, undefined, { okStatuses : [200, 204] });
        await waitFor(async() => !(await attributeExists(token, DEPENDENCIES.logicalName, lookup.lookupSchemaName.toLowerCase())), `removal of ${lookup.schemaName}`);
    }
    console.log(`Creating lookup: ${lookup.schemaName}`);
    await dv(token, 'POST', 'RelationshipDefinitions', {
        '@odata.type'               : 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
        SchemaName                  : lookup.schemaName,
        ReferencedEntity            : TASKS.logicalName,
        ReferencedAttribute         : `${TASKS.logicalName}id`,
        ReferencingEntity           : DEPENDENCIES.logicalName,
        ReferencingEntityNavigationPropertyName : lookup.navigation,
        ReferencedEntityNavigationPropertyName  : lookup.schemaName,
        AssociatedMenuConfiguration : { Behavior : 'UseCollectionName', Group : 'Details', Label : label(lookup.displayName), Order : 10000 },
        // Referential: deleting a task clears the link. (Cascade delete would make this a
        // "parental" relationship, and a table can have only one of those; the component deletes
        // the dependency rows itself when a task is removed.)
        CascadeConfiguration        : { Assign : 'NoCascade', Delete : 'RemoveLink', Merge : 'NoCascade', Reparent : 'NoCascade', Share : 'NoCascade', Unshare : 'NoCascade' },
        Lookup                      : {
            '@odata.type'     : 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
            AttributeType     : 'Lookup',
            AttributeTypeName : { Value : 'LookupType' },
            SchemaName        : lookup.lookupSchemaName,
            DisplayName       : label(lookup.displayName),
            Description       : label(`${lookup.displayName} of the dependency`),
            RequiredLevel     : requiredLevel()
        }
    }, { headers });
    await waitFor(() => attributeExists(token, DEPENDENCIES.logicalName, lookup.lookupSchemaName.toLowerCase()), lookup.schemaName);
}

async function attributeExists(token, entityLogicalName, attributeLogicalName) {
    const r = await rawDv(token, 'GET', `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')?$select=LogicalName`, undefined, { okStatuses : [200, 404] });
    return r.status === 200;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
async function seed(token, tasksSet, dependenciesSet, taskIdAttribute) {
    const sample = JSON.parse(readFileSync(resolve(here, '../sample-data/sample-project.json'), 'utf8'));
    const existing = await dv(token, 'GET', `${tasksSet}?$select=${taskIdAttribute}&$top=1`);
    if (existing.value.length) {
        console.log('Tasks table already has rows; skipping the seed.');
        return;
    }
    console.log('Seeding the sample project…');
    const idByKey = new Map();
    for (const t of sample.tasks) {
        const row = {
            [`${PREFIX}_name`]               : t.name,
            [`${PREFIX}_startdate`]          : t.startDate,
            [`${PREFIX}_enddate`]            : t.endDate,
            [`${PREFIX}_duration`]           : t.duration,
            [`${PREFIX}_durationunit`]       : 'day',
            [`${PREFIX}_percentdone`]        : t.percentDone,
            [`${PREFIX}_expanded`]           : t.expanded ? 1 : 0,
            [`${PREFIX}_manuallyscheduled`]  : 0,
            [`${PREFIX}_parentid`]           : t.parentKey ? idByKey.get(t.parentKey) : null,
            [`${PREFIX}_parentindex`]        : t.parentIndex,
            [`${PREFIX}_orderedparentindex`] : t.orderedParentIndex
        };
        const r = await rawDv(token, 'POST', tasksSet, row);
        const id = /\(([0-9a-f-]{36})\)/i.exec(r.headers.get('odata-entityid') || '')?.[1];
        idByKey.set(t.key, id);
    }
    const nameByKey = new Map(sample.tasks.map(t => [t.key, t.name]));
    for (const d of sample.dependencies) {
        await rawDv(token, 'POST', dependenciesSet, {
            [`${PREFIX}_name`]            : `${nameByKey.get(d.fromKey)} → ${nameByKey.get(d.toKey)}`,
            [`${PREFIX}_type`]            : 2,
            [`${PREFIX}_lag`]             : 0,
            [`${PREFIX}_lagunit`]         : 'day',
            [`${PREFIX}_active`]          : 1,
            [`${PREFIX}_fromside`]        : 'end',
            [`${PREFIX}_toside`]          : 'start',
            [`${PREFIX}_from@odata.bind`] : `/${tasksSet}(${idByKey.get(d.fromKey)})`,
            [`${PREFIX}_to@odata.bind`]   : `/${tasksSet}(${idByKey.get(d.toKey)})`
        });
    }
    console.log(`Seeded ${sample.tasks.length} tasks and ${sample.dependencies.length} dependencies.`);
}

// ---------------------------------------------------------------------------
// Metadata builders
// ---------------------------------------------------------------------------
function attribute(kind, schemaName, displayName, options) {
    const base = {
        SchemaName    : schemaName,
        DisplayName   : label(displayName),
        Description   : label(`${displayName} (Bryntum Gantt)`),
        RequiredLevel : requiredLevel()
    };
    switch (kind) {
        case 'string': return stringAttribute(schemaName, displayName, options);
        case 'memo': return { ...base, '@odata.type' : 'Microsoft.Dynamics.CRM.MemoAttributeMetadata', AttributeType : 'Memo', AttributeTypeName : { Value : 'MemoType' }, Format : 'TextArea', ImeMode : 'Disabled', MaxLength : options.maxLength ?? 4000, IsLocalizable : false };
        case 'datetime': return { ...base, '@odata.type' : 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', AttributeType : 'DateTime', AttributeTypeName : { Value : 'DateTimeType' }, Format : 'DateAndTime' };
        case 'double': return { ...base, '@odata.type' : 'Microsoft.Dynamics.CRM.DoubleAttributeMetadata', AttributeType : 'Double', AttributeTypeName : { Value : 'DoubleType' }, MinValue : options.min, MaxValue : options.max, Precision : options.precision ?? 2 };
        case 'integer': return { ...base, '@odata.type' : 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata', AttributeType : 'Integer', AttributeTypeName : { Value : 'IntegerType' }, MinValue : options.min, MaxValue : options.max, Format : 'None' };
        default: throw new Error(`Unknown column kind ${kind}`);
    }
}

function stringAttribute(schemaName, displayName, options = {}) {
    return {
        '@odata.type'     : 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        AttributeType     : 'String',
        AttributeTypeName : { Value : 'StringType' },
        SchemaName        : schemaName,
        DisplayName       : label(displayName),
        Description       : label(`${displayName} (Bryntum Gantt)`),
        RequiredLevel     : requiredLevel(),
        FormatName        : { Value : 'Text' },
        MaxLength         : options.maxLength ?? 100,
        ...(options.isPrimaryName ? { IsPrimaryName : true } : {})
    };
}

const label = text => ({ '@odata.type' : 'Microsoft.Dynamics.CRM.Label', LocalizedLabels : [{ '@odata.type' : 'Microsoft.Dynamics.CRM.LocalizedLabel', Label : text, LanguageCode : 1033 }] });
const requiredLevel = () => ({ Value : 'None', CanBeChanged : true, ManagedPropertyLogicalName : 'canmodifyrequirementlevelsettings' });

// ---------------------------------------------------------------------------
// Auth and HTTP
// ---------------------------------------------------------------------------
async function acquireDeviceCodeToken() {
    const scope = `${orgUrl}/user_impersonation offline_access openid profile`;
    const device = await formPost(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`, { client_id : clientId, scope });
    console.log(`\n${device.message}\n`);
    const expiresAt = Date.now() + device.expires_in * 1000;
    let interval = Math.max(5000, (device.interval || 5) * 1000);
    while (Date.now() < expiresAt) {
        await wait(interval);
        const res = await formPost(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
            grant_type  : 'urn:ietf:params:oauth:grant-type:device_code',
            client_id   : clientId,
            device_code : device.device_code
        }, { allowPending : true });
        if (res.access_token) {
            console.log('Signed in.');
            return res.access_token;
        }
        if (res.error === 'slow_down') interval += 5000;
        else if (res.error !== 'authorization_pending') throw new Error(`${res.error}: ${res.error_description}`);
    }
    throw new Error('Device-code sign-in expired.');
}

async function formPost(url, fields, options = {}) {
    const response = await fetch(url, { method : 'POST', headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }, body : new URLSearchParams(fields).toString() });
    const body = await response.json();
    if (!response.ok && !(options.allowPending && body.error)) throw new Error(`${body.error}: ${body.error_description}`);
    return body;
}

async function dv(token, method, path, body, options = {}) {
    return (await rawDv(token, method, path, body, options)).body;
}

async function rawDv(token, method, path, body, options = {}) {
    const url = path.startsWith('http') ? path : `${apiRoot}/${path}`;
    const headers = {
        Authorization      : `Bearer ${token}`,
        Accept             : 'application/json',
        'OData-MaxVersion' : '4.0',
        'OData-Version'    : '4.0',
        ...(body !== undefined ? { 'Content-Type' : 'application/json; charset=utf-8' } : {}),
        ...(options.headers || {})
    };
    const response = await fetch(url, { method, headers, body : body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    const parsed = text ? safeJson(text) : null;
    const ok = options.okStatuses || [200, 201, 204];
    if (!ok.includes(response.status)) {
        const err = new Error(parsed?.error?.message || `${method} ${path} failed with HTTP ${response.status}`);
        err.details = parsed || text;
        throw err;
    }
    return { status : response.status, headers : response.headers, body : parsed };
}

async function waitFor(check, what) {
    for (let i = 0; i < 30; i++) {
        if (await check()) return;
        await wait(4000);
    }
    throw new Error(`Timed out waiting for ${what}`);
}

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) { out[key] = next; i++; }
            else out[key] = true;
        }
    }
    return out;
}

const safeJson = t => { try { return JSON.parse(t); } catch { return t; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
