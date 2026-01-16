# Contributing Guide

Thank you for your interest in contributing to Lockdn! This document explains the contribution process and guidelines.

---

## Before You Start

### Read the Contributor Agreement

All contributions require agreement to our [Contributor Agreement](./CONTRIBUTOR_AGREEMENT.md). By submitting a pull request, you agree to its terms.

### Check Existing Issues

Before starting work:
1. Search existing issues to avoid duplicates
2. Check if someone else is already working on it
3. For features, discuss in an issue first

---

## Contribution Workflow

### 1. Fork the Repository

```bash
# Fork via GitHub UI, then clone
git clone https://github.com/YOUR_USERNAME/lockdn.git
cd lockdn
```

### 2. Set Up Development Environment

```bash
# Use Node.js 20
nvm use 20

# Install dependencies
npm install

# Start development server
npm run dev
```

### 3. Create a Feature Branch

```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

### 4. Make Your Changes

- Write code following our style guide
- Add tests for new functionality
- Update documentation as needed

### 5. Test Your Changes

```bash
# Run unit tests
npm test

# Run linting
npm run lint

# Run E2E tests
npm run test:e2e
```

### 6. Commit Your Changes

Follow conventional commit format:

```bash
git commit -m "feat: add study session notifications"
git commit -m "fix: correct grade calculation for dropped assignments"
git commit -m "docs: update API key configuration guide"
```

**Commit types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, no code change
- `refactor`: Code change that neither fixes nor adds
- `test`: Adding tests
- `chore`: Maintenance tasks

### 7. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request via GitHub.

---

## Pull Request Guidelines

### PR Title

Use the same format as commits:
- `feat: Add calendar export functionality`
- `fix: Resolve sync conflict on rapid updates`

### PR Description

Include:
- **What**: Description of changes
- **Why**: Motivation and context
- **How**: Implementation approach
- **Testing**: How you tested the changes
- **Screenshots**: For UI changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactoring

## How Has This Been Tested?
Description of testing performed

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have added tests for new functionality
- [ ] All tests pass locally
- [ ] I have updated documentation
- [ ] I have read the contributor agreement
```

---

## Code Style

### TypeScript

- Use TypeScript for all new code
- Define types for all function parameters and returns
- Avoid `any` type; use `unknown` if type is truly unknown
- Use interfaces for objects, types for unions/primitives

```typescript
// Good
interface Course {
  id: number;
  name: string;
  code: string;
}

function getCourse(id: number): Promise<Course | undefined> {
  // ...
}

// Avoid
function getCourse(id: any): any {
  // ...
}
```

### React

- Use functional components with hooks
- Use TypeScript for props (no PropTypes)
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks

```typescript
// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### File Organization

```
src/
├── components/          # React components
│   ├── ui/             # Generic UI components
│   ├── courses/        # Course-related components
│   └── ...
├── pages/              # Page components
├── lib/                # Utilities and business logic
├── db/                 # Database layer
├── hooks/              # Custom React hooks
└── types/              # TypeScript types
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `CourseCard.tsx` |
| Hooks | camelCase with `use` | `useCourses.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `Course`, `Assignment` |
| Constants | SCREAMING_SNAKE | `MAX_FILE_SIZE` |

---

## Testing Guidelines

### Unit Tests

- Test utility functions and business logic
- Use Vitest for unit tests
- Place tests next to source files: `foo.test.ts`

```typescript
// lib/gradeCalculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateWeightedGrade } from './gradeCalculator';

describe('calculateWeightedGrade', () => {
  it('calculates weighted average correctly', () => {
    const assignments = [
      { grade: 90, weight: 0.5 },
      { grade: 80, weight: 0.5 }
    ];
    expect(calculateWeightedGrade(assignments)).toBe(85);
  });
});
```

### Integration Tests

- Test component interactions
- Use React Testing Library
- Focus on user behavior, not implementation

### E2E Tests

- Test critical user flows
- Use Playwright
- Keep tests stable and maintainable

---

## Documentation Guidelines

### Code Comments

- Explain *why*, not *what*
- Document complex algorithms
- Add JSDoc for public APIs

```typescript
/**
 * Calculates the weighted average grade for a course.
 * Assignments without grades are excluded from calculation.
 *
 * @param assignments - Array of assignments with grades and weights
 * @returns Weighted average as a number 0-100, or undefined if no graded assignments
 */
export function calculateWeightedGrade(
  assignments: Assignment[]
): number | undefined {
  // ...
}
```

### User Documentation

- Write for the target audience
- Use clear, simple language
- Include examples
- Follow the [Style Guide](../STYLE_GUIDE.md)

---

## Review Process

### What Reviewers Look For

- Code quality and style
- Test coverage
- Documentation
- Performance implications
- Security considerations
- Accessibility

### Responding to Reviews

- Be receptive to feedback
- Ask questions if unclear
- Make requested changes promptly
- Explain if you disagree (with reasoning)

### Timeline

- Initial review: 1-5 business days
- Follow-up reviews: 1-3 business days
- Be patient; maintainers are volunteers

---

## Types of Contributions

### Bug Fixes

1. Reproduce the bug
2. Write a failing test (if possible)
3. Fix the bug
4. Verify test passes
5. Submit PR referencing the issue

### Features

1. Discuss in an issue first
2. Get alignment on approach
3. Implement incrementally
4. Include tests and documentation
5. Submit PR for review

### Documentation

1. Follow the style guide
2. Check for accuracy
3. Include examples where helpful
4. Submit PR

---

## Getting Merged

PRs are merged when:
- All checks pass (tests, lint, build)
- At least one maintainer approves
- All review comments are addressed
- CI is green

### Merge Strategy

We use squash merging. Your commits will be combined into one commit on main.

---

## After Merging

- Your changes will be in the next release
- You'll be credited in release notes
- Delete your feature branch
- Thank you for contributing!

---

## Questions?

- Open a GitHub Discussion
- Ask in PR comments
- Check existing documentation

We're here to help! Don't hesitate to ask questions.
