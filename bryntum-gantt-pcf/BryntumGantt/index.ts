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

        // Bryntum expects `globalThis`. Some Power Apps hosts do not expose it.
        const w = window as unknown as { globalThis?: unknown };
        if (w.globalThis !== window) {
            try {
                Object.defineProperty(window, 'globalThis', { value : window, writable : false });
            }
            catch {
                // Read-only host property; Bryntum falls back to window.
            }
        }
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
