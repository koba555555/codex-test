import Dexie, { Table } from 'dexie';
import { Diary, PhotoItem } from './types';

class DiaryDB extends Dexie {
  diaries!: Table<Diary, string>;
  photos!: Table<PhotoItem, string>;

  constructor() {
    super('constructionDiaryDB');
    this.version(1).stores({
      diaries: 'id, workDate, projectName, updatedAt',
      photos: 'id, diaryId, capturedAt, category'
    });
  }
}

export const db = new DiaryDB();
