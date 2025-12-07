import { contextBridge } from "electron";
contextBridge.exposeInMainWorld("electron", {
  // Future: Add IPC communication methods here if needed
});
