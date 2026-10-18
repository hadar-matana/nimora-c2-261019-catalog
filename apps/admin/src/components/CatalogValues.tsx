"use client";
import { useRef, useState } from 'react';
import { Plus, X, Pencil, Check } from 'lucide-react';
import { useAdmin } from './AdminContext';
import { cleanOption, type OptionKind } from '@/lib/catalog-options';

export function AddCatalogValue({kind, onAdded}: {kind: OptionKind; onAdded?: (value: string) => void}) {
  const {changeOption, notify} = useAdmin();
  const [value, setValue] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const label = kind === 'sizes' ? 'מידה חדשה' : 'צבע חדש';
  async function add() {
    if (lock.current || !cleanOption(value)) return;
    lock.current = true; setBusy(true);
    try {
      const saved = await changeOption(kind, 'add', value);
      onAdded?.(saved); setValue(''); notify('האפשרות זמינה לבחירה ולמוצרים הבאים');
    } catch (error) { notify(error instanceof Error ? error.message : 'שמירת האפשרות נכשלה', 'error'); }
    finally {lock.current = false; setBusy(false);}
  }
  return <div className="option-add">
    <label className="sr-only" htmlFor={'new-'+kind}>{label}</label>
    <input id={'new-'+kind} placeholder={label} value={value} maxLength={kind === 'sizes' ? 40 : 80} disabled={busy} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void add();}}} />
    <button type="button" className="button secondary" disabled={busy || !cleanOption(value)} onClick={()=>void add()}><Plus size={16}/>{busy ? 'שומרים…' : 'הוספה'}</button>
  </div>;
}
export function CatalogValues({kind}: {kind: OptionKind}) {
  const {catalogOptions, changeOption, notify} = useAdmin();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null), [editValue, setEditValue] = useState('');
  const lock = useRef(false);
  async function remove(value: string) {
    if(lock.current) return; lock.current=true; setBusy(true);
    try {await changeOption(kind,'remove',value);notify('האפשרות הוסרה מהרשימה. מוצרים קיימים לא השתנו');}
    catch(error){notify(error instanceof Error ? error.message : 'הסרת האפשרות נכשלה','error');}
    finally{lock.current=false;setBusy(false);}
  }
  async function rename() {
    if(lock.current || !editing || !cleanOption(editValue)) return; lock.current=true;setBusy(true);
    try {await changeOption(kind,'rename',editValue,editing);setEditing(null);notify('שם האפשרות עודכן ברשימה בלבד. מוצרים קיימים לא השתנו');}
    catch(error){notify(error instanceof Error ? error.message : 'עדכון האפשרות נכשל','error');}
    finally{lock.current=false;setBusy(false);}
  }
  return <section className="category-panel catalog-values"><h2>{kind==='sizes'?'מידות':'צבעים'}</h2>
    <p className="field-help">רשימה לבחירה מהירה במוצרים. שינוי שם או הסרה מהרשימה אינם משנים מוצרים קיימים.</p>
    <AddCatalogValue kind={kind}/>
    <div className="reusable-options">{catalogOptions[kind].map(value=><div className="reusable-option" key={value}>{editing===value ? <><input aria-label="שם אפשרות חדש" value={editValue} maxLength={kind==='sizes'?40:80} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void rename();}}}/><button className="icon-button" disabled={busy} aria-label="שמירת שם אפשרות" onClick={()=>void rename()}><Check size={16}/></button><button className="icon-button" disabled={busy} aria-label="ביטול עריכת אפשרות" onClick={()=>setEditing(null)}><X size={16}/></button></> : <><span dir="auto">{value}</span><button className="icon-button" disabled={busy} aria-label={'עריכת '+value} onClick={()=>{setEditing(value);setEditValue(value);}}><Pencil size={16}/></button></>}<button type="button" className="icon-button" disabled={busy} aria-label={'הסרת '+value+' מהרשימה'} onClick={()=>void remove(value)}><X size={16}/></button></div>)}</div>
    {!catalogOptions[kind].length && <p className="field-help">הרשימה ריקה. אפשר להוסיף כאן או מתוך המוצר.</p>}
  </section>;
}
