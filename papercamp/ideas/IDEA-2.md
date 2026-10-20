---
id: IDEA-2
title: Три стежки — навігація-подорож і ліс, що змінює форму
type: feat
status: in-progress
tags: [web, navigation, canvas, motion]
created: 2026-10-20
---

Three directions out of the home forest, each a journey rather than a page
swap, and on every page the forest morphs into forms that tell what the page
is about.

- **Музика** (right): the camera walks right along the forest; a stump grows
  into a record player, after the back cover of Jethro Tull's «Songs from
  the Wood».
- **Коріння** (down): the story of the band and its members. The horizon
  rises and leaves a thin white strip with the mark in the middle; the trees
  that stood up into the sky press down into the ground and turn into white
  lines of roots, with roots under the mark too.
- **Знахідки** (left): everyone's other work: photos, drawings, poems. The
  camera walks left and the trees turn into leaves, like a herbarium.

Decisions (2026-10-20, with the user): names «Музика», «Коріння»,
«Знахідки»; transitions are a journey with per-page morphs.

### Phases

- [x] A world wider than the screen with a camera that pans between pages
  Trees planted over three screens; skyline, trees and mark drawn relative to the camera.
- [x] Routes and navigation: edge links, arrow keys, swipes
  `/music`, `/roots`, `/finds`; links on the right, bottom and left edges; a way home.
- [x] Коріння: the horizon rises, trees press down into white roots
- [x] Музика: the stump record player
- [x] Знахідки: trees turn into leaves
- [ ] Tune with the user on the dev server: root density, stump and record, leaf sizes, timing
