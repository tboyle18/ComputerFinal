import { useQuery } from '@tanstack/react-query';
import {
  Bike,
  BookOpen,
  Car,
  Gamepad2,
  Gem,
  Guitar,
  Laptop,
  Package,
  Palette,
  Shirt,
  Sofa,
  type LucideIcon,
} from 'lucide-react';
import { getCategories } from '../api/listings';

const ICONS: Record<string, LucideIcon> = {
  electronics: Laptop,
  fashion: Shirt,
  home: Sofa,
  sports: Bike,
  books: BookOpen,
  toys: Gamepad2,
  collectibles: Gem,
  art: Palette,
  music: Guitar,
  vehicles: Car,
};

export const categoryIcon = (slug: string): LucideIcon => ICONS[slug] ?? Package;

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: getCategories, staleTime: Infinity });
}

export function useCategoryName() {
  const { data } = useCategories();
  return (slug: string) => data?.find((c) => c.slug === slug)?.name ?? slug;
}
