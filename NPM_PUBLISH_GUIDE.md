# 发布到 npm 的快速指南

## 准备工作

1. **注册 npm 账号**（如果还没有）
2. **设置包名和作者信息**
3. **最终测试**
4. **发布**

## 详细步骤

### 1. 注册 npm 账号

访问 https://www.npmjs.com/signup 注册：

- **Username**（用户名）：公开可见，会出现在包名前缀
- **Email**：用于通知和验证
- **Password**：至少 10 个字符

注册后会收到验证邮件，点击链接激活账号。

### 2. 本地登录 npm

```bash
npm login
# 输入刚才注册的用户名、密码和邮箱
# 成功后会显示 "Logged in as <你的用户名> on https://registry.npmjs.org/"
```

### 3. 修改 package.json

在发布前，修改这些字段：

```json
{
  "name": "dsh-novel-master",
  "version": "1.1.0",
  "author": "你的名字 <your@email.com>",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/你的用户名/dsh-novel-master.git"
  },
  "bugs": {
    "url": "https://github.com/你的用户名/dsh-novel-master/issues"
  },
  "homepage": "https://github.com/你的用户名/dsh-novel-master#readme"
}
```

### 4. 最终检查

```bash
# 运行测试
npm test

# 检查打包内容
npm pack --dry-run

# 确保没有敏感信息
grep -r "password\|token\|secret" src/
```

### 5. 发布到 npm

```bash
# 第一次发布
npm publish

# 如果包名已被占用，可以用带 scope 的名字
# 把 package.json 的 name 改成 "@你的用户名/dsh-novel-master"
# 然后发布：
npm publish --access public
```

### 6. 验证发布

访问 https://www.npmjs.com/package/dsh-novel-master 确认包已经上线。

### 7. 后续更新

修改代码后：

```bash
# 更新版本号（三选一）
npm version patch  # 1.1.0 → 1.1.1（修复 bug）
npm version minor  # 1.1.0 → 1.2.0（新功能）
npm version major  # 1.1.0 → 2.0.0（破坏性变更）

# 发布新版本
npm publish
```

## 常见问题

### 包名已被占用

如果 `dsh-novel-master` 已经被别人占用了，有两个办法：

1. **改包名**：`dsh-novel-writer`、`dsh-writer-master` 之类的
2. **用 scoped 包**：`@你的用户名/dsh-novel-master`（推荐）

### 发布失败：403 Forbidden

说明这个包名已被注册。试试带 scope 的名字：

```bash
# 修改 package.json 的 name 为 "@你的用户名/dsh-novel-master"
npm publish --access public
```

### 忘记密码

访问 https://www.npmjs.com/forgot 重置密码。

### 需要双因素认证（2FA）

npm 强烈建议启用 2FA。启用后发布时需要输入验证码：

```bash
npm profile enable-2fa auth-and-writes
# 按提示用手机验证器（Google Authenticator、Authy）扫码
```

## GitHub 推送（可选）

如果要把代码推送到 GitHub：

```bash
# 创建 GitHub 仓库（在 GitHub 网站操作）
# 然后本地关联：
git remote add origin https://github.com/你的用户名/dsh-novel-master.git
git branch -M main
git push -u origin main
```

## 发布清单

- [ ] 注册并登录 npm
- [ ] 修改 `package.json` 的 author、repository、bugs、homepage
- [ ] 运行 `npm test` 确保所有测试通过
- [ ] 运行 `npm pack --dry-run` 检查打包内容
- [ ] 确认没有敏感信息
- [ ] 运行 `npm publish`（或 `npm publish --access public` for scoped packages）
- [ ] 访问 npmjs.com 验证发布成功
- [ ] （可选）推送到 GitHub
