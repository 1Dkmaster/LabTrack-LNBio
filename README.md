# LabTrack-LNBio

Primeira versão de protótipo do sistema de rastreabilidade e verificação de equipamentos do laboratório.

## Visão geral

Este projeto implementa uma versão funcional inicial do LabTrack LNBio, com foco em:

- dashboard de indicadores;
- cadastro e listagem de equipamentos;
- histórico de atividades por equipamento;
- status público para consulta rápida;
- registro de limpeza, inspeção e manutenção;
- interface demonstrativa sem autenticação;
- armazenamento local em navegador para prototipagem rápida.

## Estrutura

- `index.html`: estrutura principal da interface
- `styles.css`: layout e visual do sistema
- `app.js`: regras de negócio, dados iniciais e interações

## Como executar

1. Abra a pasta do projeto no VS Code.
2. Inicie um servidor local simples, por exemplo:
   `python -m http.server 8000`
3. Acesse `http://localhost:8000` no navegador.

## Funcionalidades da versão inicial

- listagem de equipamentos por categoria;
- identificação por TAG e seleção por categoria;
- painel de indicadores do laboratório;
- identificação pelo seletor de equipamentos ou pela TAG;
- seleção de equipamentos agrupada por categoria;
- catálogo inicial com 18 equipamentos identificados na planilha `Inventario_Tags_LNBIO_V3.xlsx`;
- registro de verificação, calibração diária, manutenção e limpeza com responsável informado, checklist preenchido e data/hora automáticas;
- histórico individual, relatório para impressão/salvamento em PDF e exportação CSV compatível com planilhas;
- aba de status público para consulta rápida;
- dados técnicos do equipamento;
- link de identificação por TAG para associar a um QR físico;
- cadastro de novos equipamentos no navegador.

## Observação

Esta é uma versão de protótipo front-end. Os dados ficam somente no navegador e não são sincronizados entre usuários ou dispositivos. A exportação CSV é uma cópia do histórico no momento da exportação, não uma planilha vinculada em tempo real. O link por TAG pode ser associado a um QR físico, mas o sistema ainda não gera imagens QR nem autentica/autoriza usuários. O nome digitado no formulário é declarado pelo operador e não confirma sua identidade.

Os equipamentos e registros iniciais são demonstrativos. Novos equipamentos começam sem histórico ou datas técnicas fictícias. O checklist é preenchido por quem realiza a atividade; critérios técnicos precisam vir de procedimentos aprovados e não são fornecidos pelo protótipo. Não use esta versão como registro oficial, nem para armazenar dados sensíveis.

O catálogo inicial importa uma seleção de TAGs e nomes da planilha de inventário (balanças, centrífugas, pHmetros e outros). A lista é mesclada aos dados já salvos neste navegador sem sobrescrever registros existentes. Localização, status técnico, histórico, fabricante separado e demais campos que não constam na planilha permanecem como não informados ou não verificados.

Na ficha do equipamento, escolha **Visão geral**, **Histórico** ou **Dados do equipamento** para exibir uma seção por vez. O dashboard não trata a ausência de datas na planilha como limpeza ou inspeção vencida.
