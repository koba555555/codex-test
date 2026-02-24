export type PhotoCategory = '着手前' | '施工中' | '完了' | 'その他';

export interface WorkforceItem { id: string; role: string; count: number; }
export interface MaterialItem { id: string; name: string; spec: string; quantity: number; unit: string; }
export interface TemperatureItem {
  id: string;
  tripNo: string;
  shippingTemp?: number;
  arrivalTemp?: number;
  pavingTemp?: number;
  initialRollTemp?: number;
  secondaryRollTemp?: number;
}
export interface PhotoItem {
  id: string;
  diaryId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  summary: string;
  category: PhotoCategory;
  capturedAt: string;
  createdAt: string;
}

export interface Diary {
  id: string;
  projectName: string;
  location: string;
  workDate: string;
  weather: string;
  temperature?: number;
  workContent: string;
  notes: string;
  machines: string[];
  workforce: WorkforceItem[];
  materials: MaterialItem[];
  temperatures: TemperatureItem[];
  createdAt: string;
  updatedAt: string;
}
