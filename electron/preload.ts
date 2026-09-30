// The renderer's only door into the desktop shell: window.cardnewsDesktop
// (typed in lib/desktop.ts). Its presence is also how the UI knows it's running
// inside the desktop app.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const on = (channel: string) => (fn: (v: unknown) => void) => {
  const l = (_e: IpcRendererEvent, v: unknown) => fn(v);
  ipcRenderer.on(channel, l);
  return () => {
    ipcRenderer.removeListener(channel, l);
  };
};

contextBridge.exposeInMainWorld("cardnewsDesktop", {
  platform: process.platform,
  license: {
    info: () => ipcRenderer.invoke("license:info"),
    activate: (key: string) => ipcRenderer.invoke("license:activate", key),
    deactivate: () => ipcRenderer.invoke("license:deactivate"),
    onChange: on("license:changed"),
  },
  update: {
    status: () => ipcRenderer.invoke("update:status"),
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    onStatus: on("update:status"),
  },
  openExternal: (url: string) => ipcRenderer.invoke("app:openExternal", url),
  openDataFolder: () => ipcRenderer.invoke("app:openDataFolder"),
});
