# causal-tiling-novelty-measurement-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Measures recurrence and novelty of finite causal symbolic patches without claiming infinite tiling equivalence.

## Measure a patch

```js
import { measureCausalPatchNovelty } from '@red-cup-engineering/causal-tiling-novelty-measurement-service';

const result = measureCausalPatchNovelty({ tokens: ['a', 'b', 'a', 'b'], patchSize: 2 });
console.log(result.recurrenceCount); // 1
```

The current patch is the last `patchSize` tokens. Eligible earlier windows end before it starts. The function compares individual string tokens, computes the recurrence frequency across eligible windows, and returns novelty as `1 / (1 + recurrenceCount)`. A measurement requires two complete patches. The default patch size is five.

Run `npm test` to check prior-window boundaries, token identity and invalid inputs.
