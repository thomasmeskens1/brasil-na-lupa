#!/usr/bin/env node
/**
 * Mantido só para compatibilidade com os scripts "predev"/"prebuild" atuais: a seção São Paulo
 * passou a ser a UF "sp" da seção Estados, gerada por gerar-estados.mjs (que lê content/alesp
 * e content/governo-sp por adaptador). Pode ser removido quando o package.json chamar
 * gerar-estados.mjs diretamente.
 */
import "./gerar-estados.mjs";
