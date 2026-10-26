import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractPortablePDF} from '../src/pdf-portable.cjs';
import pdfFixture from './pdf-fixture.cjs';
test('Portable reader extracts real PDF text with accents',async()=>{const result=await extractPortablePDF(pdfFixture('Expérience réelle : ingénieur Python.'));assert.match(result.text,/Expérience réelle/);assert.equal(result.pages,1);assert.equal(result.emptyPages,0);});
test('Portable reader rejects invalid, empty and oversized documents',async()=>{await assert.rejects(extractPortablePDF(Buffer.from('not a PDF')),/illisible/);await assert.rejects(extractPortablePDF(pdfFixture('')),/sans texte/);await assert.rejects(extractPortablePDF(Buffer.alloc(10*1024*1024+1)),/10 Mo/);});
test('Portable PDF reading can be cancelled before and during extraction',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(extractPortablePDF(pdfFixture(),{signal:controller.signal}),/annulé/);const active=new AbortController();const result=extractPortablePDF(pdfFixture(),{signal:active.signal});active.abort();await assert.rejects(result,/annulé/);});
