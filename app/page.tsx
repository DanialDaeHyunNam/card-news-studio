"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { loadProjects, saveProjects } from "@/lib/store";
import { LangProvider } from "@/lib/i18n";
import Home from "@/components/Home";
import Editor from "@/components/Editor";

export default function App() {
  return (
    <LangProvider>
      <Root />
    </LangProvider>
  );
}

function Root() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  if (!projects) return null; // avoid hydration mismatch with localStorage

  const persist = (next: Project[]) => {
    setProjects(next);
    saveProjects(next);
  };

  const open = openId ? projects.find((p) => p.id === openId) : undefined;

  if (open) {
    return (
      <Editor
        project={open}
        onChange={(p) => persist(projects.map((x) => (x.id === p.id ? p : x)))}
        onClose={() => setOpenId(null)}
      />
    );
  }

  return (
    <Home
      projects={projects}
      onOpen={setOpenId}
      onCreate={(p) => {
        persist([...projects, p]);
        setOpenId(p.id);
      }}
      onDelete={(id) => persist(projects.filter((p) => p.id !== id))}
    />
  );
}
