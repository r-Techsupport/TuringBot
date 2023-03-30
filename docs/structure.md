This document explains the filestructure at a broad level.

`~/` will refer to the root of the repository in documentation.

`~/src` will contain all code

`~/src/core` will contain the heart of the bot. This includes module management, shard management, and interfaces for modules like logging or an embed framework.

`~/src/modules` will contain modules. A module is a piece of code that makes use of the core to provide functionality. They will primarily be files, (EG:  `google.ts`), but there should also be support for directories (`google/`) with several files in them, and a file named the same as the directory being the code exported. Expanding on the google example, that may contain files like `image.ts`, `text.ts`, `youtube.ts`, with `google.ts` being mandatory and implementing code from these other files. 

`~/docs` will contain documentation



