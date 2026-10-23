import * as React from 'react';

export function LoadingSpinner() {
    return (
        <div className="bryntum-gantt-pcf-loader">
            <div className="bryntum-gantt-pcf-spinner" />
            <div>Loading Bryntum Gantt…</div>
        </div>
    );
}

export function ErrorPanel({ message, hint }: { message: string; hint: string }) {
    return (
        <div className="bryntum-gantt-pcf-error">
            <h3>Bryntum Gantt could not load its data</h3>
            <p>{message}</p>
            <p className="bryntum-gantt-pcf-hint">{hint}</p>
        </div>
    );
}
