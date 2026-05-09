# Graph Report - /Volumes/T7/Projects/Rorschach  (2026-05-09)

## Corpus Check
- Corpus is ~12,693 words - fits in a single context window. You may not need a graph.

## Summary
- 93 nodes · 107 edges · 13 communities detected
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 2,100 input · 1,800 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Provider Adapter Layer|Provider Adapter Layer]]
- [[_COMMUNITY_Tweak Panel Controls|Tweak Panel Controls]]
- [[_COMMUNITY_Voice & TTS Pipeline|Voice & TTS Pipeline]]
- [[_COMMUNITY_Inkblot Card Generation|Inkblot Card Generation]]
- [[_COMMUNITY_Identity & Design System|Identity & Design System]]
- [[_COMMUNITY_Screen Navigation|Screen Navigation]]
- [[_COMMUNITY_SVG Inkblot Rendering|SVG Inkblot Rendering]]
- [[_COMMUNITY_App Entry Point|App Entry Point]]
- [[_COMMUNITY_Face Component|Face Component]]
- [[_COMMUNITY_API Key Vault|API Key Vault]]
- [[_COMMUNITY_Couch Screen Rationale|Couch Screen Rationale]]
- [[_COMMUNITY_Data Layer|Data Layer]]
- [[_COMMUNITY_Notes Screen|Notes Screen]]

## God Nodes (most connected - your core abstractions)
1. `Routing Engine` - 13 edges
2. `Provider Adapter Interface` - 11 edges
3. `Inkblot / Rorschach Identity Theme` - 6 edges
4. `makeBlotCard()` - 5 edges
5. `makeMaskCard()` - 5 edges
6. `Provider Plate Concept` - 5 edges
7. `rng()` - 4 edges
8. `smoothClosedPath()` - 4 edges
9. `makeSymmetricRing()` - 4 edges
10. `buildPart()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Rorschach Mask Reference Images` --conceptually_related_to--> `Provider Plate Concept`  [INFERRED]
  uploads/mask.jpg → README.md
- `Inkblot Mask Preview UI Screenshot` --conceptually_related_to--> `Design System (Parchment + Ink Theme)`  [INFERRED]
  screenshots/mask-preview.png → README.md
- `Rorschach Mask Reference Images` --semantically_similar_to--> `Inkblot Mask Preview UI Screenshot`  [INFERRED] [semantically similar]
  uploads/mask.jpg → screenshots/mask-preview.png
- `Inkblot Mask Preview UI Screenshot` --conceptually_related_to--> `Inkblot / Rorschach Identity Theme`  [EXTRACTED]
  screenshots/mask-preview.png → README.md
- `Rorschach Mask Reference Images` --conceptually_related_to--> `Inkblot / Rorschach Identity Theme`  [EXTRACTED]
  uploads/mask.jpg → README.md

## Hyperedges (group relationships)
- **All Hosted AI Providers** — readme_provider_openai, readme_provider_anthropic, readme_provider_gemini, readme_provider_grok, readme_provider_mistral, readme_provider_deepseek, readme_provider_llama [EXTRACTED 1.00]
- **All Local AI Providers** — readme_provider_ollama, readme_provider_lmstudio, readme_provider_custom [EXTRACTED 1.00]
- **Five App Screens** — readme_screen_plates, readme_screen_couch, readme_screen_diagnosis, readme_screen_notes, readme_screen_vault [EXTRACTED 1.00]
- **Inkblot Visual Design Assets** — screenshot_mask_preview, upload_mask_jpg, readme_inkblot_identity, readme_design_system [INFERRED 0.85]

## Communities

### Community 0 - "Provider Adapter Layer"
Cohesion: 0.18
Nodes (18): Fallback Chain, Local Server Auto-Discovery, Provider Adapter Interface, Anthropic/Claude Provider (Plate II), Custom OpenAI-Compatible Provider (Plate X), DeepSeek Provider (Plate VI), Google Gemini Provider (Plate III), xAI Grok Provider (Plate IV) (+10 more)

### Community 1 - "Tweak Panel Controls"
Cohesion: 0.13
Nodes (0): 

### Community 2 - "Voice & TTS Pipeline"
Cohesion: 0.17
Nodes (2): makeRecorder(), pickMime()

### Community 3 - "Inkblot Card Generation"
Cohesion: 0.35
Nodes (8): buildDeck(), buildPart(), makeBlotCard(), makeMaskCard(), makeSymmetricRing(), mirrorPart(), rng(), smoothClosedPath()

### Community 4 - "Identity & Design System"
Cohesion: 0.25
Nodes (11): Clinical Session Metaphor, Design System (Parchment + Ink Theme), Inkblot Agent HTML Prototype, Inkblot / Rorschach Identity Theme, Multi-Provider AI Hub, Provider Plate Concept, Rationale: Inkblot as Provider Metaphor, Rorschach Bot (+3 more)

### Community 5 - "Screen Navigation"
Cohesion: 0.25
Nodes (0): 

### Community 6 - "SVG Inkblot Rendering"
Cohesion: 0.33
Nodes (0): 

### Community 7 - "App Entry Point"
Cohesion: 1.0
Nodes (0): 

### Community 8 - "Face Component"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "API Key Vault"
Cohesion: 1.0
Nodes (2): API Key Management, Screen: The Vault

### Community 10 - "Couch Screen Rationale"
Cohesion: 1.0
Nodes (2): Rationale: Clinical Session as UI Metaphor, Screen: The Couch

### Community 11 - "Data Layer"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Notes Screen"
Cohesion: 1.0
Nodes (1): Screen: The Notes

## Knowledge Gaps
- **13 isolated node(s):** `Fallback Chain`, `Screen: The Plates`, `Screen: The Couch`, `Screen: The Diagnosis`, `Screen: The Notes` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Entry Point`** (2 nodes): `App()`, `app.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Face Component`** (2 nodes): `InkblotFace()`, `face.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Key Vault`** (2 nodes): `API Key Management`, `Screen: The Vault`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Couch Screen Rationale`** (2 nodes): `Rationale: Clinical Session as UI Metaphor`, `Screen: The Couch`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Data Layer`** (1 nodes): `data.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notes Screen`** (1 nodes): `Screen: The Notes`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Fallback Chain`, `Screen: The Plates`, `Screen: The Couch` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Tweak Panel Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._