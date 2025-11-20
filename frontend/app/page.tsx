"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Auth from '@/components/Auth';
import { ImportModal } from '@/components/ImportModal';
import { Session } from '@supabase/supabase-js';
import { Plus, Music, LogOut, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

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
                            <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors flex flex-col gap-3"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold">
                                            {project.title || 'Untitled Project'}
                                        </div>
                                        <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 mt-1">
                                            {new Date(project.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    {statusIcon(project.status)}
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
                            </Link>
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
