// Dataverse schema the component reads and writes. Everything is created by
// scripts/provision-dataverse.mjs (or by importing the solution zip), under the
// "Bryntum" publisher with the customization prefix "bryntum".
//
// If you point the component at your own tables, change the names here and in
// BryntumGanttComponent.types.ts, rebuild, and re-import the solution.

export const publisherPrefix = 'bryntum_';

export const tasksTable = {
    logicalName        : 'bryntum_bryntumgantttask',
    // Dataverse pluralises the logical name for the OData entity set. The component
    // double-checks this at runtime through context.utils.getEntityMetadata().
    entitySetName      : 'bryntum_bryntumgantttasks',
    primaryIdAttribute : 'bryntum_bryntumgantttaskid'
};

export const dependenciesTable = {
    logicalName        : 'bryntum_bryntumganttdependency',
    entitySetName      : 'bryntum_bryntumganttdependencies',
    primaryIdAttribute : 'bryntum_bryntumganttdependencyid'
};

// Lookup columns on the dependency table that point at the task table.
export const dependencyFromLookup = 'bryntum_from';
export const dependencyToLookup = 'bryntum_to';
