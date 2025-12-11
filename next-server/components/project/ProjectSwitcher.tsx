"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProjectListItemDto } from "@/domain/project";

interface ProjectSwitcherProps {
  currentProject: ProjectListItemDto;
  projects: ProjectListItemDto[];
  className?: string;
}

/**
 * プロジェクト切り替えコンポーネント
 * プロジェクトの一覧表示と選択
 */
export function ProjectSwitcher({
  currentProject,
  projects,
  className,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // プロジェクトのフィルタリング
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(query));
  }, [projects, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-gray-100 hover:bg-gray-200 border-0 text-gray-700 font-medium",
            className,
          )}
        >
          <span className="truncate">{currentProject.name}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>プロジェクトを選択</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {/* 検索入力 */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="プロジェクトを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* プロジェクトリスト */}
          <div className="max-h-80 overflow-y-auto space-y-1">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/spaces`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-150",
                    project.id === currentProject.id
                      ? "bg-blue-50 text-blue-600"
                      : "hover:bg-gray-100 text-gray-700",
                  )}
                >
                  <Check
                    className={cn(
                      "size-4",
                      project.id === currentProject.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="truncate flex-1">{project.name}</span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                プロジェクトが見つかりません
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
