# Contributing to dsh-mobile-xc

感谢你考虑为 dsh-mobile-xc 做贡献！

Thank you for your interest in contributing to dsh-mobile-xc!

## Development Setup / 开发环境设置

### Prerequisites / 前置要求

- Node.js >= 18
- pnpm (recommended) / npm

### Setup / 设置

```bash
# Clone the repository
git clone https://github.com/keyiadiannao/dsh-mobile-xc.git
cd dsh-mobile-xc

# Install dependencies
pnpm install
```

### Development Commands / 开发命令

```bash
# Type checking / 类型检查
pnpm verify

# Run tests / 运行测试
pnpm test

# Build / 构建
pnpm build

# Watch mode / 监听模式
# (Manual rebuild required after changes)
pnpm build
```

## Code Style / 代码风格

- Follow existing code style / 遵循现有代码风格
- Run `pnpm verify` before committing / 提交前运行 pnpm verify
- Use TypeScript strict mode / 使用 TypeScript 严格模式

## Commit Convention / 提交规范

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` New feature / 新功能
- `fix:` Bug fix / Bug 修复
- `docs:` Documentation / 文档
- `style:` Code style (no code change) / 代码风格（不影响代码运行）
- `refactor:` Refactoring / 重构
- `test:` Tests / 测试
- `chore:` Maintenance / 维护

## Submitting Changes / 提交变更

1. Fork the repository / Fork 本仓库
2. Create a feature branch / 创建功能分支: `git checkout -b feature/my-feature`
3. Make your changes / 进行修改
4. Run tests and verify / 运行测试和验证: `pnpm verify && pnpm test`
5. Commit your changes / 提交修改: `git commit -m 'feat: add my feature'`
6. Push to the branch / 推送到分支: `git push origin feature/my-feature`
7. Open a Pull Request / 创建 Pull Request

## Pull Request Guidelines / Pull Request 指南

- Fill in the PR template / 填写 PR 模板
- Link related issues / 关联相关 issue
- Add tests if applicable / 如适用，添加测试
- Update documentation if needed / 如需要，更新文档

## Code of Conduct / 行为准则

- Be respectful and inclusive / 尊重和包容
- Welcome new contributors / 欢迎新贡献者
- Focus on constructive feedback / 关注建设性反馈

## Questions? / 有问题？

Open an issue or start a discussion on GitHub.

在 GitHub 上创建 issue 或开启讨论。
