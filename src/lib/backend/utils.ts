import { createId } from "@paralleldrive/cuid2";
import { writable } from "svelte/store";
import type { Monaco } from "./monaco";
import type { TypstCoreDefinition, TypstCoreDefinitionFn, TypstCoreDefinitionStd, TypstCoreDefinitionVar } from "wolframe-typst-core";

export const debugLogStore = writable<{
    id: string;
    type?: 'info' | 'error' | 'warning';
    domain?: string;
    timestamp: string;
    message: string;
}[]>([]);

export function debug(type?: 'error' | 'warning' | 'info', domain?: string,...args: unknown[]) {
    //if (import.meta.env.MODE === "development") { // Only log in development mode
        // log with timestamp
        const timestamp = new Date().toISOString();
        let formattedArgs = [];
        try {
            formattedArgs = args.map(arg => {
                if (typeof arg === "object") {
                    return JSON.stringify(arg, null, 2); // Pretty print objects
                }
                return arg;
            });
        } catch (e) {
            formattedArgs = args;
        }

        switch (type) {
            case "error":
                console.error(`[${timestamp}]`, ...args);
                break;
            case "warning":
                console.warn(`[${timestamp}]`, ...args);
                break;
            case "info":
                console.info(`[${timestamp}]`, ...args);
                break;
            default:
                console.log(`[${timestamp}]`, ...args);
        }

        debugLogStore.update(logs => [...logs, {
            id: createId(),
            type,
            domain,
            timestamp,
            message: formattedArgs.join(" ")
        }]);
    //}
}

export function getIdFromUri(uri: Monaco.Uri) {
    const id = uri.toString().replace("fileid:", "").replace(/\/file\..*$/, "");
    if (!id) {
        throw new Error("Model is not set yet.");
    }
    return id;
}

export namespace EnumTypeGuards {
    export namespace TypstCoreDefinition {
        export function isNone(def: TypstCoreDefinition): def is "None" {
            return def === "None";
        }
        export function isStd(def: TypstCoreDefinition): def is { Std: TypstCoreDefinitionStd } {
            return typeof def === "object" && "Std" in def;
        }
        export function isFn(def: TypstCoreDefinition): def is { Fn: TypstCoreDefinitionFn } {
            return typeof def === "object" && "Fn" in def;
        }
        export function isVar(def: TypstCoreDefinition): def is { Var: TypstCoreDefinitionVar } {
            return typeof def === "object" && "Var" in def;
        }
    }
}