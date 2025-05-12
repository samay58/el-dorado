import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface ListingFilters {
  minPrice?: string;
  maxPrice?: string;
  minBeds?: string;
}

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  initial: ListingFilters;
  onApply: (filters: ListingFilters) => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({ open, onClose, initial, onApply }) => {
  const [values, setValues] = useState<ListingFilters>(initial);

  const applyAndClose = () => {
    onApply(values);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Filters">
      <div className="space-y-4">
        <Input
          type="number"
          placeholder="Min Price ($)"
          value={values.minPrice ?? ''}
          onChange={(e) => setValues(v => ({ ...v, minPrice: e.target.value }))}
        />
        <Input
          type="number"
          placeholder="Max Price ($)"
          value={values.maxPrice ?? ''}
          onChange={(e) => setValues(v => ({ ...v, maxPrice: e.target.value }))}
        />
        <Input
          type="number"
          placeholder="Min Beds"
          value={values.minBeds ?? ''}
          onChange={(e) => setValues(v => ({ ...v, minBeds: e.target.value }))}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={applyAndClose}>Apply</Button>
        </div>
      </div>
    </Modal>
  );
}; 