import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {DocumentContext,extractPDF} from '../src/documents.cjs';
import pdfFixture from './pdf-fixture.cjs';
const make=(extract=async()=>({text:'Python : expérience réelle.',pages:1}))=>new DocumentContext({extract});
test('Document store extracts once, deduplicates files and exposes no text in the list',async()=>{
 let calls=0;const d=make(async()=>{calls++;return{text:'Python',pages:1};});
 await d.add({name:'CV.pdf',data:pdfFixture()});await d.add({name:'CV copie.pdf',data:pdfFixture()});
 assert.equal(calls,1);assert.equal(d.list().length,1);assert.equal(d.list()[0].text,undefined);assert.equal(d.context()[0].text,'Python');
 d.remove(d.list()[0].id);assert.deepEqual(d.context(),[]);
});
test('Rejects invalid types, false PDF extension, oversized files and excess documents',async()=>{
 const d=make();await assert.rejects(d.add({name:'cv.txt',data:pdfFixture()}),/PDF/);
 await assert.rejects(d.add({name:'cv.pdf',data:Buffer.from('hello')}),/invalide/);
 await assert.rejects(d.add({name:'cv.pdf',data:Buffer.alloc(10*1024*1024+1)}),/10 Mo/);
 for(let i=0;i<5;i++)await d.add({name:i+'.pdf',data:pdfFixture(String(i))});
 await assert.rejects(d.add({name:'six.pdf',data:pdfFixture('six')}),/5 PDF/);
});
test('Clearing an interview cancels active and queued imports and prevents context resurrection',async()=>{
 let release;const d=make(()=>new Promise(r=>release=r));
 const first=d.add({name:'a.pdf',data:pdfFixture('a')}),second=d.add({name:'b.pdf',data:pdfFixture('b')});
 const rejected1=assert.rejects(first,/annulé/),rejected2=assert.rejects(second,/annulé/);
 await new Promise(r=>setImmediate(r));d.clear();release({text:'secret',pages:1});await Promise.all([rejected1,rejected2]);assert.deepEqual(d.context(),[]);
});
test('The context limit rejects the extra document without truncating existing documents',async()=>{
 const d=make(async()=>({text:'a'.repeat(40000),pages:1}));await d.add({name:'a.pdf',data:pdfFixture('a')});
 await assert.rejects(d.add({name:'b.pdf',data:pdfFixture('b')}),/Contexte trop long/);assert.equal(d.context()[0].text.length,40000);assert.equal(d.list().length,1);
});
const helper=path.resolve('build/native',process.arch,'clair-pdf-text');
test('Native PDFKit extracts an actual PDF, including accents, without an API', {skip:process.platform!=='darwin'||!existsSync(helper)},async()=>{
 const result=await extractPDF(helper,pdfFixture('Expérience réelle : ingénieur Python.'));assert.match(result.text,/Expérience réelle/);assert.equal(result.pages,1);
 await assert.rejects(extractPDF(helper,Buffer.from('not a PDF')),/illisible/);
 await assert.rejects(extractPDF(helper,pdfFixture('')),/sans texte/);
});
