---
name: api
description: 设计和审查 API 接口，确保一致性、易用性和向后兼容性。
---

调用 api-and-interface-design 技能。Contract-first 设计，确保接口稳定可靠。

1. 理解 API 需求 — 业务场景、调用方、数据模型
2. 设计接口签名 — 输入/输出/错误码，遵循一致的命名和格式
3. 定义边界条件和错误场景
4. 评估向后兼容性和版本策略
5. 提供示例请求和响应

## 使用方式

在 `/api` 后描述你的 API 需求（RESTful / GraphQL / RPC / SDK），我将设计接口方案。

### 示例

```
# 设计 RESTful 接口
/api 设计用户管理模块的 RESTful API，包括注册、登录、个人信息 CRUD

# 模块边界设计
/api 设计支付模块与订单模块的接口边界，需要支持异步回调

# 审查现有 API
/api 审查 src/controllers/ 下的接口设计，检查一致性和错误处理规范
```
