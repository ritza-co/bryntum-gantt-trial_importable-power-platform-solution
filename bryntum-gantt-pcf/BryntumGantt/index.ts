import * as React from 'react';
import { BryntumGanttComponent } from './BryntumGanttComponent';
import { IBryntumGanttComponentProps } from './BryntumGanttComponent.types';
import { IInputs, IOutputs } from './generated/ManifestTypes';

export class Gantt implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged: () => void;

    constructor() { }

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        // Ask the host for allocatedWidth/allocatedHeight so the Gantt can fill its container.
        context.mode.trackContainerResize(true);

        // Note: custom pages evaluate this bundle in a wrapper scope where the bare identifier
        // `globalThis` is a Power Apps context object, not the window. That is handled at build
        // time by webpack.config.js (ProvidePlugin), not here: the `window.globalThis` property
        // is untouched by the host, so a runtime check on it never fires.
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        const props: IBryntumGanttComponentProps = { context };
        return React.createElement(BryntumGanttComponent, props);
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        // The React wrapper destroys the Bryntum instance when the element unmounts.
    }
}
