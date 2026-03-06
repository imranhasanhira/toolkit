import React, { useState } from 'react';
import { Button } from '../../../../client/components/ui/button';
import { Input } from '../../../../client/components/ui/input';
import { Label } from '../../../../client/components/ui/label';
import { Card, CardContent } from '../../../../client/components/ui/card';
import { Plus, Pencil, Trash2, Star, X, Check, Loader2 } from 'lucide-react';
import { useQuery } from 'wasp/client/operations';
import { getAspectRatios, createAspectRatio, updateAspectRatio, deleteAspectRatio } from 'wasp/client/operations';
import { ConfirmationDialog } from '../../../../client/components/ui/confirmation-dialog';
import toast from 'react-hot-toast';
import type { AspectRatio } from 'wasp/entities';

export function AspectRatiosNode() {
  const { data: aspectRatios, isLoading, error } = useQuery(getAspectRatios);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', width: '', height: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData({ name: '', width: '', height: '' });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    const width = parseInt(formData.width);
    const height = parseInt(formData.height);
    if (!formData.name.trim() || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      toast.error('Please fill in all fields with valid values');
      return;
    }
    setSaving(true);
    try {
      await createAspectRatio({ name: formData.name.trim(), width, height });
      toast.success('Aspect ratio created');
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create aspect ratio');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const width = parseInt(formData.width);
    const height = parseInt(formData.height);
    if (!formData.name.trim() || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      toast.error('Please fill in all fields with valid values');
      return;
    }
    setSaving(true);
    try {
      await updateAspectRatio({ id: editingId, name: formData.name.trim(), width, height });
      toast.success('Aspect ratio updated');
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update aspect ratio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAspectRatio({ id });
      toast.success('Aspect ratio deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete aspect ratio');
    }
  };

  const handleSetDefault = async (ar: AspectRatio) => {
    try {
      await updateAspectRatio({ id: ar.id, isDefault: true });
      toast.success(`${ar.name} set as default`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to set default');
    }
  };

  const startEdit = (ar: AspectRatio) => {
    setEditingId(ar.id);
    setFormData({ name: ar.name, width: String(ar.width), height: String(ar.height) });
    setShowAddForm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-sm">Failed to load aspect ratios</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Manage aspect ratios for shot image generation. Each story can use a different aspect ratio.
      </p>

      {/* Existing Aspect Ratios */}
      <div className="space-y-2">
        {aspectRatios?.map((ar) => (
          <div key={ar.id}>
            {editingId === ar.id ? (
              <Card className="border-blue-200">
                <CardContent className="p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Landscape"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Width</Label>
                      <Input
                        type="number"
                        value={formData.width}
                        onChange={(e) => setFormData(prev => ({ ...prev, width: e.target.value }))}
                        placeholder="16"
                        min={1}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height</Label>
                      <Input
                        type="number"
                        value={formData.height}
                        onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                        placeholder="9"
                        min={1}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={resetForm} disabled={saving}>
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleUpdate} disabled={saving}>
                      {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {ar.isDefault && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                    <span className="font-medium text-sm">{ar.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                    {ar.width}:{ar.height}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {!ar.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(ar)}
                      title="Set as default"
                      className="h-7 w-7 p-0"
                    >
                      <Star className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(ar)}
                    className="h-7 w-7 p-0"
                  >
                    <Pencil className="h-3.5 w-3.5 text-gray-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm({ open: true, id: ar.id, name: ar.name })}
                    className="h-7 w-7 p-0"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showAddForm ? (
        <Card className="border-green-200">
          <CardContent className="p-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Square"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Width</Label>
                <Input
                  type="number"
                  value={formData.width}
                  onChange={(e) => setFormData(prev => ({ ...prev, width: e.target.value }))}
                  placeholder="1"
                  min={1}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Height</Label>
                <Input
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                  placeholder="1"
                  min={1}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" onClick={resetForm} disabled={saving}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { resetForm(); setShowAddForm(true); }}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Aspect Ratio
        </Button>
      )}

      <ConfirmationDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title="Delete Aspect Ratio"
        description={`Are you sure you want to delete "${deleteConfirm.name}"? This will also delete all associated shot images.`}
        variant="destructive"
        confirmText="Delete"
        onConfirm={() => handleDelete(deleteConfirm.id)}
      />
    </div>
  );
}
