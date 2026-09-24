/*
| Variabili globali per i template Edge: formattazione it-IT, glossario,
| navigazione.
*/
import edge from 'edge.js'
import * as formato from '#ui/formato'
import { glossario } from '#ui/glossario'
import { vociGlobali, vociCommessa } from '#ui/nav'

edge.global('formato', formato)
edge.global('glossario', glossario)
edge.global('nav', { vociGlobali, vociCommessa })
