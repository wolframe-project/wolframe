import type { File, IBackendFileSystem } from "@/app.types";

export class IndexedDBVFS implements IBackendFileSystem {
    private dbName: string = 'VFS';
    private storeName: string;
    private _db: IDBDatabase | null = null;

    constructor(storeName: string) {
        this.storeName = storeName;
    }

    private get db(): Promise<IDBDatabase> {
        if (this._db) {
            return Promise.resolve(this._db);
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                store.createIndex('parentId', 'parentId', { unique: false });
            };

            request.onsuccess = (event) => {
                this._db = (event.target as IDBOpenDBRequest).result;
                resolve(this._db);
            };

            request.onerror = (event) => {
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }


    createFile(file: File): Promise<File> {
        return this.db.then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.add(file);

                request.onsuccess = () => resolve(file);
                request.onerror = (event) => reject((event.target as IDBRequest).error);
            });
        });
    }

    deleteFile(id: string): Promise<void> {
        return this.db.then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(id);

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject((event.target as IDBRequest).error);
            });
        });
    }

    updateFile(file: File): Promise<File> {
        return this.db.then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put(file);

                request.onsuccess = () => resolve(file);
                request.onerror = (event) => reject((event.target as IDBRequest).error);
            });
        });
    }

    updateFileContent(id: string, content: string): Promise<File> {
        throw new Error("Method not implemented.");
    }

    getFile(id: string): Promise<File | null> {
        return this.db.then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(id);

                request.onsuccess = (event) => {
                    const file = (event.target as IDBRequest).result;
                    resolve(file || null);
                };
                request.onerror = (event) => reject((event.target as IDBRequest).error);
            });
        });
    }

    listFiles(): Promise<File[]> {
        return this.db.then(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();

                request.onsuccess = (event) => {
                    const files = (event.target as IDBRequest).result;
                    resolve(files);
                };
                request.onerror = (event) => reject((event.target as IDBRequest).error);
            });
        });
    }
}