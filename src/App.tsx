import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from './db';
import { Diary, MaterialItem, PhotoCategory, PhotoItem, TemperatureItem, WorkforceItem } from './types';
import { downloadBlob, estimateCapturedAt, resizeImage, uid } from './utils';

type Tab = 'basic' | 'materials' | 'temperature' | 'photos' | 'export';

const weatherOptions = ['晴れ', '曇り', '雨', '雪'];
const photoCategories: PhotoCategory[] = ['着手前', '施工中', '完了', 'その他'];

const emptyDiary = (): Diary => ({
  id: uid(),
  projectName: '',
  location: '',
  workDate: new Date().toISOString().slice(0, 10),
  weather: '晴れ',
  temperature: undefined,
  workContent: '',
  notes: '',
  machines: [''],
  workforce: [{ id: uid(), role: '', count: 1 }],
  materials: [{ id: uid(), name: '', spec: '', quantity: 0, unit: 't' }],
  temperatures: [{ id: uid(), tripNo: '' }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

function PhotoCard({ photo, onChange, onDelete }: { photo: PhotoItem; onChange: (patch: Partial<PhotoItem>) => void; onDelete: () => void }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(photo.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [photo.blob]);

  return (
    <div className="rounded border p-2">
      {src && <img src={src} className="mb-2 h-32 w-full rounded object-cover" alt={photo.fileName} />}
      <div className="grid gap-2 md:grid-cols-3">
        <select className="rounded border p-2" value={photo.category} onChange={(e) => onChange({ category: e.target.value as PhotoCategory })}>
          {photoCategories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className="rounded border p-2 md:col-span-2" placeholder="摘要" value={photo.summary} onChange={(e) => onChange({ summary: e.target.value })} />
      </div>
      <div className="mt-1 text-xs text-slate-500">撮影時刻: {new Date(photo.capturedAt).toLocaleString('ja-JP')}</div>
      <button type="button" className="mt-2 rounded bg-red-600 px-3 py-1 text-white" onClick={onDelete}>削除</button>
    </div>
  );
}

export default function App() {
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Diary>(emptyDiary());
  const [tab, setTab] = useState<Tab>('basic');
  const [qDate, setQDate] = useState('');
  const [qProject, setQProject] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    const rows = await db.diaries.orderBy('workDate').reverse().toArray();
    setDiaries(rows);
  };

  useEffect(() => {
    void load();
  }, []);

  const selectDiary = async (id: string) => {
    const diary = await db.diaries.get(id);
    if (!diary) return;
    setSelectedId(id);
    setEditing(diary);
    setPhotos(await db.photos.where('diaryId').equals(id).toArray());
  };

  const filtered = useMemo(
    () => diaries.filter((d) => d.workDate.includes(qDate) && d.projectName.toLowerCase().includes(qProject.toLowerCase())),
    [diaries, qDate, qProject]
  );

  const updateField = <K extends keyof Diary>(key: K, value: Diary[K]) => setEditing((prev) => ({ ...prev, [key]: value }));

  const normalizeDiary = (diary: Diary): Diary => ({
    ...diary,
    machines: diary.machines.filter((m) => m.trim() !== ''),
    workforce: diary.workforce.filter((w) => w.role.trim() !== '' && Number.isFinite(w.count) && w.count > 0),
    materials: diary.materials.filter((m) => m.name.trim() !== ''),
    temperatures: diary.temperatures.filter((t) => t.tripNo.trim() !== '')
  });

  const persistDiary = async () => {
    if (!editing.projectName || !editing.location || !editing.workDate || !editing.workContent) {
      setError('必須項目（工事名、施工箇所、日付、作業内容）を入力してください。');
      return;
    }
    if (editing.workforce.some((w) => Number.isNaN(w.count) || w.count < 0) || editing.materials.some((m) => Number.isNaN(m.quantity) || m.quantity < 0)) {
      setError('人数・数量は0以上の数値で入力してください。');
      return;
    }
    setError('');
    const payload = normalizeDiary({ ...editing, updatedAt: new Date().toISOString() });
    await db.diaries.put(payload);
    setSelectedId(payload.id);
    setEditing(payload);
    await load();
  };

  const newDiary = () => {
    setEditing(emptyDiary());
    setSelectedId(null);
    setPhotos([]);
    setError('');
    setTab('basic');
  };

  const deleteDiary = async (id: string) => {
    await db.transaction('rw', db.diaries, db.photos, async () => {
      await db.diaries.delete(id);
      await db.photos.where('diaryId').equals(id).delete();
    });
    const nextId = diaries.find((d) => d.id !== id)?.id;
    await load();
    if (nextId) await selectDiary(nextId);
    else newDiary();
  };

  const duplicateDiary = async () => {
    const now = new Date().toISOString();
    const newId = uid();
    const dup: Diary = { ...editing, id: newId, workDate: new Date().toISOString().slice(0, 10), createdAt: now, updatedAt: now };
    await db.diaries.add(dup);
    if (photos.length) {
      const cloned = photos.map((p) => ({ ...p, id: uid(), diaryId: newId, createdAt: now }));
      await db.photos.bulkAdd(cloned);
    }
    await load();
    await selectDiary(newId);
  };

  const seedSample = async () => {
    const sampleId = uid();
    const now = new Date().toISOString();
    await db.diaries.put({
      id: sampleId,
      projectName: '市道A線舗装修繕工事',
      location: '東京都港区芝公園1-1',
      workDate: new Date().toISOString().slice(0, 10),
      weather: '晴れ',
      temperature: 18,
      workContent: '路面切削後、アスファルト敷均しと転圧を実施。',
      notes: '交通誘導員を2名追加。',
      machines: ['アスファルトフィニッシャ', 'ロードローラー'],
      workforce: [{ id: uid(), role: '作業員', count: 5 }, { id: uid(), role: '交通誘導員', count: 2 }],
      materials: [{ id: uid(), name: '再生密粒度As', spec: '13mm', quantity: 12, unit: 't' }],
      temperatures: [{ id: uid(), tripNo: '1', shippingTemp: 162, arrivalTemp: 154, pavingTemp: 147, initialRollTemp: 136, secondaryRollTemp: 118 }],
      createdAt: now,
      updatedAt: now
    });
    await load();
    await selectDiary(sampleId);
  };

  const refreshPhotos = async () => {
    if (!selectedId) return;
    setPhotos(await db.photos.where('diaryId').equals(selectedId).toArray());
  };

  const addPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !selectedId) return;
    for (const file of Array.from(e.target.files)) {
      const blob = await resizeImage(file);
      await db.photos.add({
        id: uid(),
        diaryId: selectedId,
        fileName: file.name,
        mimeType: 'image/jpeg',
        blob,
        summary: '',
        category: '施工中',
        capturedAt: estimateCapturedAt(file),
        createdAt: new Date().toISOString()
      });
    }
    await refreshPhotos();
    e.target.value = '';
  };

  const updatePhoto = async (id: string, patch: Partial<PhotoItem>) => {
    await db.photos.update(id, patch);
    await refreshPhotos();
  };

  const removePhoto = async (id: string) => {
    await db.photos.delete(id);
    await refreshPhotos();
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [
      ['工事名', editing.projectName], ['施工箇所', editing.location], ['日付', editing.workDate], ['天候', editing.weather], ['気温', editing.temperature ?? ''], ['作業内容', editing.workContent], ['備考', editing.notes], [],
      ['人員'], ['職種', '人数'], ...editing.workforce.map((w) => [w.role, w.count]), [],
      ['重機'], ['名称'], ...editing.machines.map((m) => [m]), [],
      ['材料'], ['材料名', '規格', '数量', '単位'], ...editing.materials.map((m) => [m.name, m.spec, m.quantity, m.unit]), [],
      ['温度管理'], ['便No', '出荷', '到着', '敷均し', '初期転圧', '二次転圧'], ...editing.temperatures.map((t) => [t.tripNo, t.shippingTemp ?? '', t.arrivalTemp ?? '', t.pavingTemp ?? '', t.initialRollTemp ?? '', t.secondaryRollTemp ?? '']), [],
      ['写真一覧'], ['ファイル名', '分類', '摘要', '撮影時刻'], ...photos.map((p) => [p.fileName, p.category, p.summary, p.capturedAt])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, editing.workDate);
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const safeName = (editing.projectName || '工事日誌').replace(/[\\/:*?"<>|]/g, '_');
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeName}_${editing.workDate}.xlsx`);
  };

  const RowEditor = <T extends { id: string }>(props: {
    title: string;
    rows: T[];
    columns: { key: keyof T; type?: 'number' | 'text'; placeholder?: string }[];
    onChange: (rows: T[]) => void;
    factory: () => T;
  }) => (
    <div className="space-y-2">
      <h3 className="font-bold">{props.title}</h3>
      {props.rows.map((r) => (
        <div key={r.id} className="overflow-auto rounded border p-2">
          <div className="grid min-w-[560px] grid-cols-12 gap-2">
            {props.columns.map((c) => (
              <input
                key={String(c.key)}
                className="col-span-2 rounded border p-2"
                type={c.type ?? 'text'}
                placeholder={c.placeholder}
                value={(r[c.key] as string | number | undefined) ?? ''}
                onChange={(e) => props.onChange(props.rows.map((row) => row.id === r.id ? ({ ...row, [c.key]: c.type === 'number' ? Number(e.target.value) : e.target.value } as T) : row))}
              />
            ))}
            <button type="button" className="col-span-2 rounded bg-red-500 text-white" onClick={() => props.onChange(props.rows.filter((x) => x.id !== r.id))}>削除</button>
          </div>
        </div>
      ))}
      <button type="button" className="rounded bg-slate-700 px-4 py-2 text-white" onClick={() => props.onChange([...props.rows, props.factory()])}>追加</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl p-3 pb-24 text-sm text-slate-900">
      <h1 className="mb-1 text-xl font-bold">工事日誌PWA</h1>
      <p className="mb-4 text-xs text-slate-600">オフライン対応 / IndexedDB保存 / iPhoneホーム画面追加対応</p>
      <div className="grid gap-3 md:grid-cols-[360px_1fr]">
        <section className="rounded-xl bg-white p-3 shadow">
          <h2 className="mb-2 text-lg font-bold">一覧</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <input className="rounded border p-2" type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} />
            <input className="rounded border p-2" placeholder="工事名検索" value={qProject} onChange={(e) => setQProject(e.target.value)} />
          </div>
          <div className="mt-2 max-h-[56vh] space-y-2 overflow-auto">
            {filtered.map((d) => (
              <button type="button" key={d.id} className={`w-full rounded border p-2 text-left ${selectedId === d.id ? 'border-blue-600 bg-blue-50' : ''}`} onClick={() => selectDiary(d.id)}>
                <div className="font-bold">{d.projectName}</div>
                <div className="text-xs text-slate-600">{d.workDate} / {d.location}</div>
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className="rounded bg-blue-700 p-3 font-bold text-white" onClick={newDiary}>新規</button>
            <button type="button" className="rounded bg-emerald-700 p-3 font-bold text-white" onClick={persistDiary}>保存</button>
            <button type="button" className="rounded bg-amber-600 p-3 font-bold text-white" onClick={duplicateDiary}>複製</button>
            <button type="button" className="rounded bg-red-700 p-3 font-bold text-white" onClick={() => selectedId && deleteDiary(selectedId)} disabled={!selectedId}>削除</button>
          </div>
          <button type="button" className="mt-2 w-full rounded bg-slate-500 p-2 font-bold text-white" onClick={seedSample}>サンプルデータ投入</button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </section>

        <section className="rounded-xl bg-white p-3 shadow">
          <div className="mb-2 grid grid-cols-5 gap-1 text-xs font-bold">
            {([
              ['basic', '基本'], ['materials', '材料/人員'], ['temperature', '温度'], ['photos', '写真'], ['export', '確認&出力']
            ] as [Tab, string][]).map(([key, label]) => (
              <button type="button" key={key} className={`rounded p-2 ${tab === key ? 'bg-blue-700 text-white' : 'bg-slate-200'}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tab === 'basic' && <div className="space-y-2">
            <input className="w-full rounded border p-2" placeholder="工事名*" value={editing.projectName} onChange={(e) => updateField('projectName', e.target.value)} />
            <input className="w-full rounded border p-2" placeholder="施工箇所*" value={editing.location} onChange={(e) => updateField('location', e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <input className="rounded border p-2" type="date" value={editing.workDate} onChange={(e) => updateField('workDate', e.target.value)} />
              <select className="rounded border p-2" value={editing.weather} onChange={(e) => updateField('weather', e.target.value)}>{weatherOptions.map((w) => <option key={w}>{w}</option>)}</select>
              <input className="rounded border p-2" type="number" placeholder="気温" value={editing.temperature ?? ''} onChange={(e) => updateField('temperature', e.target.value ? Number(e.target.value) : undefined)} />
            </div>
            <textarea className="min-h-24 w-full rounded border p-2" placeholder="作業内容*" value={editing.workContent} onChange={(e) => updateField('workContent', e.target.value)} />
            <textarea className="min-h-20 w-full rounded border p-2" placeholder="備考" value={editing.notes} onChange={(e) => updateField('notes', e.target.value)} />
          </div>}

          {tab === 'materials' && <div className="space-y-4">
            <RowEditor<WorkforceItem> title="人員" rows={editing.workforce} columns={[{ key: 'role', placeholder: '職種名' }, { key: 'count', type: 'number', placeholder: '人数' }]} onChange={(v) => updateField('workforce', v)} factory={() => ({ id: uid(), role: '', count: 1 })} />
            <div>
              <h3 className="mb-2 font-bold">重機</h3>
              {editing.machines.map((m, i) => (
                <div key={`${m}-${i}`} className="mb-2 flex gap-2">
                  <input className="w-full rounded border p-2" placeholder="重機名" value={m} onChange={(e) => updateField('machines', editing.machines.map((x, idx) => idx === i ? e.target.value : x))} />
                  <button type="button" className="rounded bg-red-500 px-3 text-white" onClick={() => updateField('machines', editing.machines.filter((_, idx) => idx !== i))}>削除</button>
                </div>
              ))}
              <button type="button" className="rounded bg-slate-700 px-4 py-2 text-white" onClick={() => updateField('machines', [...editing.machines, ''])}>追加</button>
            </div>
            <RowEditor<MaterialItem> title="材料" rows={editing.materials} columns={[{ key: 'name', placeholder: '材料名' }, { key: 'spec', placeholder: '規格' }, { key: 'quantity', type: 'number', placeholder: '数量' }, { key: 'unit', placeholder: '単位' }]} onChange={(v) => updateField('materials', v)} factory={() => ({ id: uid(), name: '', spec: '', quantity: 0, unit: '' })} />
          </div>}

          {tab === 'temperature' && <RowEditor<TemperatureItem> title="温度管理（車両ごと）" rows={editing.temperatures} columns={[
            { key: 'tripNo', placeholder: '便No' }, { key: 'shippingTemp', type: 'number', placeholder: '出荷' }, { key: 'arrivalTemp', type: 'number', placeholder: '到着' }, { key: 'pavingTemp', type: 'number', placeholder: '敷均し' }, { key: 'initialRollTemp', type: 'number', placeholder: '初期転圧' }, { key: 'secondaryRollTemp', type: 'number', placeholder: '二次転圧' }
          ]} onChange={(v) => updateField('temperatures', v)} factory={() => ({ id: uid(), tripNo: '' })} />}

          {tab === 'photos' && <div className="space-y-3">
            <input type="file" accept="image/*" capture="environment" multiple onChange={addPhoto} disabled={!selectedId} />
            {!selectedId && <p className="text-xs text-slate-500">先に日誌を保存すると写真を添付できます。</p>}
            {photos.map((photo) => <PhotoCard key={photo.id} photo={photo} onChange={(patch) => updatePhoto(photo.id, patch)} onDelete={() => removePhoto(photo.id)} />)}
          </div>}

          {tab === 'export' && <div className="space-y-2">
            <h3 className="text-base font-bold">入力確認</h3>
            <p>工事名: {editing.projectName || '未入力'}</p>
            <p>日付: {editing.workDate}</p>
            <p>人員: {editing.workforce.reduce((acc, cur) => acc + (cur.count || 0), 0)} 名</p>
            <p>写真: {photos.length} 枚</p>
            <button type="button" className="rounded bg-indigo-700 px-4 py-3 font-bold text-white" onClick={exportExcel}>Excel(.xlsx)出力</button>
          </div>}
        </section>
      </div>
    </div>
  );
}
