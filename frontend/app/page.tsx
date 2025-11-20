"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Auth from '@/components/Auth';
import { ImportModal } from '@/components/ImportModal';
import { Session } from '@supabase/supabase-js';
import { Plus, Music, LogOut, Clock, CheckCircle2, AlertCircle, Pencil, Trash2 } from 'lucide-react';

type ProjectRow = {
    id: string;
    title: string | null;
    status: string | null;
    progress: number | null;
    created_at: string;
};

function statusIcon(status?: string | null) {
    if (status === 'completed') return <CheckCircle2 className="text-emerald-400" size={16} />;
    if (status === 'failed') return <AlertCircle className="text-red-400" size={16} />;
    return <Clock className="text-amber-300" size={16} />;
}

function ProjectsDashboard({ session }: { session: Session }) {
    const router = useRouter();
    const [projects, setProjects] = useState<ProjectRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showImport, setShowImport] = useState(false);
    const [renamingProject, setRenamingProject] = useState<ProjectRow | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [deletingProject, setDeletingProject] = useState<ProjectRow | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchProjects = async () => {
            const { data, error } = await supabase
                .from('projects')
                .select('id, title, status, progress, created_at')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });
            if (!error && data && isMounted) {
                setProjects(data);
            }
            if (isMounted) {
                setLoading(false);
            }
        };

        fetchProjects();
        const interval = setInterval(fetchProjects, 4000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [session.user.id]);

    const handleRenameSubmit = async () => {
        if (!renamingProject) return;
        const trimmed = renameValue.trim();
        setActionLoading(true);
        const { error } = await supabase
            .from('projects')
            .update({ title: trimmed || null })
            .eq('id', renamingProject.id)
            .eq('user_id', session.user.id);
        setActionLoading(false);
        if (error) {
            console.error('Failed to rename project', error);
            return;
        }
        setProjects(prev => prev.map(project =>
            project.id === renamingProject.id
                ? { ...project, title: trimmed || null }
                : project
        ));
        setRenamingProject(null);
        setRenameValue('');
    };

    const handleDeleteProject = async () => {
        if (!deletingProject) return;
        setActionLoading(true);
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', deletingProject.id)
            .eq('user_id', session.user.id);
        setActionLoading(false);
        if (error) {
            console.error('Failed to delete project', error);
            return;
        }
        setProjects(prev => prev.filter(project => project.id !== deletingProject.id));
        setDeletingProject(null);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900">
                <div className="flex items-center gap-3">
                    <Music className="text-indigo-500" size={22} />
                    <div>
                        <h1 className="text-xl font-bold">Your Projects</h1>
                        <p className="text-xs text-zinc-500">{session.user.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setShowImport(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <Plus size={16} />
                        New Project
                    </button>
                    <button 
                        onClick={() => supabase.auth.signOut()}
                        className="text-zinc-500 hover:text-white"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main className="flex-1 px-8 py-10 space-y-6">
                {loading ? (
                    <div className="text-zinc-500">Loading projects…</div>
                ) : projects.length === 0 ? (
                    <div className="border border-dashed border-zinc-800 rounded-2xl p-10 text-center text-zinc-400">
                        <p className="text-lg font-semibold mb-2">No projects yet</p>
                        <p className="text-sm mb-6">Import a song to get started with stems and clips.</p>
                        <button
                            onClick={() => setShowImport(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
                        >
                            <Plus size={16} />
                            Import Song
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {projects.map(project => (
                            <div
                                key={project.id}
                                className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors flex flex-col gap-3 cursor-pointer"
                                onClick={() => router.push(`/projects/${project.id}`)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5">
                                            {statusIcon(project.status)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold">
                                                {project.title || 'Untitled Project'}
                                            </div>
                                            <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 mt-1">
                                                {new Date(project.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            className="p-2 text-xs rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRenamingProject(project);
                                                setRenameValue(project.title ?? '');
                                            }}
                                            title="Rename project"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            className="p-2 text-xs rounded-full text-red-400 hover:text-white hover:bg-red-500/20 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeletingProject(project);
                                            }}
                                            title="Delete project"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-zinc-500">
                                        <span>Status: {project.status || 'pending'}</span>
                                        <span>{Math.round(project.progress ?? 0)}%</span>
                                    </div>
                                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${project.status === 'failed' ? 'bg-red-500' : project.status === 'completed' ? 'bg-green-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${Math.min(100, Math.round(project.progress ?? 0))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showImport && (
                <ImportModal
                    onClose={() => setShowImport(false)}
                    onComplete={(projectId) => {
                        setShowImport(false);
                        router.push(`/projects/${projectId}`);
                    }}
                />
            )}

            {renamingProject && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-10 px-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
                        <div>
                            <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Rename Project</div>
                            <div className="text-lg font-semibold text-white mt-1">
                                {renamingProject.title || 'Untitled Project'}
                            </div>
                        </div>
                        <input
                            type="text"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                            placeholder="Project name"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                                onClick={() => {
                                    setRenamingProject(null);
                                    setRenameValue('');
                                }}
                                disabled={actionLoading}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleRenameSubmit}
                                disabled={actionLoading}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deletingProject && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-10 px-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4">
                        <div>
                            <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Delete Project</div>
                            <div className="text-lg font-semibold text-white mt-2">
                                {deletingProject.title || 'Untitled Project'}
                            </div>
                            <p className="text-xs text-zinc-400 mt-2">
                                This will remove the project, clips, and related stems from your workspace. This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                                onClick={() => setDeletingProject(null)}
                                disabled={actionLoading}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleDeleteProject}
                                disabled={actionLoading}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ProjectsPage() {
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (!session) {
        return <Auth />;
    }

    return <ProjectsDashboard session={session} />;
}
