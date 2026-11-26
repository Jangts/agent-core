# 应用数据格式示例

以下 JSON 仅解释 App 自有记录的字段设计，不参与运行加载，不登记能力或创建数据表。Core 不要求采用这套存储格式。

使用 null／空数组表示尚未提供，不以示例默认值制造事实。字段名、状态和版本由 App 自己定义并校验。

## 材料记录

原件、提取状态、归属、生命周期与发布状态。

```json
{
  "schemaVersion": 1,
  "id": null,
  "ownerId": null,
  "scope": "private",
  "original": { "reference": null, "mediaType": null, "contentSha256": null, "receivedAt": null },
  "extraction": { "status": "pending", "revision": null, "text": null, "caveats": [] },
  "lifetime": "turn",
  "expiresAt": null,
  "publication": { "status": "unpublished", "documentId": null }
}
```

## 用户偏好

累计交流偏好、来源水位和版本。

```json
{
  "schemaVersion": 1,
  "ownerId": null,
  "revision": null,
  "summary": null,
  "sourceWindow": { "after": null, "through": null, "references": [] },
  "updatedAt": null,
  "expiresAt": null,
  "status": "uninitialized"
}
```

## 经验候选

经验来源、适用范围、验证与发布状态。

```json
{
  "schemaVersion": 1,
  "id": null,
  "ownerId": null,
  "revision": null,
  "status": "candidate",
  "claim": null,
  "applicability": [],
  "sources": [],
  "counterexamples": [],
  "conflicts": [],
  "validation": { "status": "pending", "references": [] },
  "publication": { "approvedBy": null, "approvedAt": null, "documentId": null }
}
```

用户偏好不能承载身份与权限；经验候选不自动发布；原始材料不自动进入共享知识。见[资料维护](maintenance.md)、[材料](materials.md)与[持续积累](memory-and-learning.md)。
