// `node --test` uchun: '@/...' import yo'llarini loyiha ildiziga yo'naltiradi (tsconfig paths bilan bir xil).
import { register } from 'node:module';

register('./alias-loader.mjs', import.meta.url);
