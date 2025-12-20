"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NotificationFormData {
  message: string;
  displayOrder: number;
  isActive: boolean;
}

interface NotificationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NotificationFormData) => void;
  isSubmitting: boolean;
}

/**
 * 通知作成フォームダイアログ
 */
export function NotificationForm({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: NotificationFormProps) {
  const [message, setMessage] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    onSubmit({
      message: message.trim(),
      displayOrder,
      isActive,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // リセット
      setMessage("");
      setDisplayOrder(0);
      setIsActive(true);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>通知を追加</DialogTitle>
          <DialogDescription>
            ユーザーに表示する通知メッセージを設定します
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">メッセージ</Label>
            <Textarea
              id="message"
              placeholder="通知メッセージを入力..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
              required
            />
            <p className="text-xs text-gray-500 text-right">
              {message.length}/1000
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayOrder">表示順</Label>
            <Input
              id="displayOrder"
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-gray-500">
              数値が小さいほど先に表示されます
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">有効にする</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting || !message.trim()}>
              {isSubmitting ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
