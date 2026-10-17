<template>
  <div class="project-directory-input">
    <label :for="inputId" class="input-label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>
    
    <div class="input-wrapper">
      <input
        :id="inputId"
        v-model="localValue"
        type="text"
        class="path-input"
        :class="{ 
          'input-error': validationResult && !validationResult.valid,
          'input-warning': validationResult && validationResult.valid && hasWarning,
          'input-success': validationResult && validationResult.valid && !hasWarning
        }"
        :placeholder="placeholder"
        @input="handleInput"
        @blur="handleBlur"
      />
      
      <!-- 验证状态图标 -->
      <span v-if="validationResult" class="status-icon">
        <svg v-if="validationResult.valid && !hasWarning" class="icon-success" viewBox="0 0 16 16">
          <path d="M13.5 3.5L6 11 2.5 7.5" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        <svg v-else-if="validationResult.valid && hasWarning" class="icon-warning" viewBox="0 0 16 16">
          <path d="M8 2L14 14H2L8 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <circle cx="8" cy="11" r="0.8" fill="currentColor"/>
          <line x1="8" y1="6" x2="8" y2="9" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <svg v-else class="icon-error" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8" cy="11.5" r="0.8" fill="currentColor"/>
        </svg>
      </span>
    </div>
    
    <!-- 验证消息 -->
    <div v-if="validationResult && validationResult.message" class="validation-message">
      <p 
        class="message-text"
        :class="{
          'message-error': !validationResult.valid,
          'message-warning': validationResult.valid && hasWarning,
          'message-success': validationResult.valid && !hasWarning
        }"
      >
        {{ validationResult.message }}
      </p>
      
      <!-- 自动修复按钮 -->
      <button
        v-if="!validationResult.valid && validationResult.suggestion"
        type="button"
        class="fix-button"
        @click="applySuggestion"
      >
        <svg class="icon-fix" viewBox="0 0 16 16">
          <path d="M13 3l-8 8-3-3" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        自动修复为 "{{ validationResult.suggestion }}"
      </button>
    </div>
    
    <!-- 帮助文本 -->
    <p v-if="helpText" class="help-text">
      {{ helpText }}
    </p>
  </div>
</template>

<script>
/**
 * 项目目录输入组件 - 带实时验证和自动修复
 */
export default {
  name: 'ProjectDirectoryInput',
  
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: '项目目录'
    },
    placeholder: {
      type: String,
      default: 'novel_projects'
    },
    helpText: {
      type: String,
      default: '相对于工作目录的路径，如 "novel_projects" 或 "books/novels"'
    },
    required: {
      type: Boolean,
      default: false
    },
    // 当前工作目录（用于从绝对路径提取相对路径）
    cwd: {
      type: String,
      default: null
    },
    // 是否在输入时实时验证（默认只在失焦时验证）
    validateOnInput: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['update:modelValue', 'validation'],
  
  data() {
    return {
      localValue: this.modelValue,
      validationResult: null,
      inputId: `project-dir-${Math.random().toString(36).slice(2)}`
    }
  },
  
  computed: {
    hasWarning() {
      if (!this.validationResult || !this.validationResult.valid) return false
      return this.validationResult.normalized !== this.localValue.trim().replace(/\\/g, '/')
    }
  },
  
  watch: {
    modelValue(newValue) {
      if (newValue !== this.localValue) {
        this.localValue = newValue
      }
    }
  },
  
  methods: {
    async handleInput() {
      if (this.validateOnInput) {
        await this.validate()
      }
    },
    
    async handleBlur() {
      await this.validate()
    },
    
    async validate() {
      if (!this.localValue.trim()) {
        this.validationResult = null
        this.$emit('validation', { valid: false, error: 'empty' })
        return
      }
      
      try {
        // 调用后端验证
        const response = await fetch('/api/novel/validate-project-directory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            directory: this.localValue,
            cwd: this.cwd
          })
        })
        
        const result = await response.json()
        this.validationResult = result
        this.$emit('validation', result)
        
        // 如果验证通过且值被规范化，自动更新
        if (result.valid && result.normalized !== this.localValue.trim().replace(/\\/g, '/')) {
          this.$emit('update:modelValue', result.normalized)
        }
      } catch (error) {
        console.error('路径验证失败:', error)
        this.validationResult = {
          valid: false,
          error: '验证失败',
          message: '无法连接到验证服务'
        }
        this.$emit('validation', { valid: false, error: 'network' })
      }
    },
    
    applySuggestion() {
      if (this.validationResult && this.validationResult.suggestion) {
        this.localValue = this.validationResult.suggestion
        this.$emit('update:modelValue', this.validationResult.suggestion)
        this.validate()
      }
    }
  }
}
</script>

<style scoped>
.project-directory-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #e5e7eb);
}

.required {
  color: var(--error-color, #ef4444);
  margin-left: 0.25rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.path-input {
  flex: 1;
  padding: 0.625rem 2.5rem 0.625rem 0.875rem;
  font-size: 0.9375rem;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  color: var(--text-primary, #e5e7eb);
  background: var(--surface-2, #0f131c);
  border: 1px solid var(--border-color, #1e2636);
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.path-input:focus {
  outline: none;
  border-color: var(--accent-color, #38bdf8);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
}

.path-input.input-error {
  border-color: var(--error-color, #ef4444);
}

.path-input.input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.path-input.input-warning {
  border-color: var(--warning-color, #f59e0b);
}

.path-input.input-success {
  border-color: var(--success-color, #10b981);
}

.status-icon {
  position: absolute;
  right: 0.75rem;
  display: flex;
  align-items: center;
  pointer-events: none;
}

.icon-success,
.icon-warning,
.icon-error {
  width: 1.25rem;
  height: 1.25rem;
}

.icon-success {
  color: var(--success-color, #10b981);
}

.icon-warning {
  color: var(--warning-color, #f59e0b);
}

.icon-error {
  color: var(--error-color, #ef4444);
}

.validation-message {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message-text {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.4;
}

.message-error {
  color: var(--error-color, #ef4444);
}

.message-warning {
  color: var(--warning-color, #f59e0b);
}

.message-success {
  color: var(--success-color, #10b981);
}

.fix-button {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #e5e7eb);
  background: var(--accent-color, #38bdf8);
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s;
}

.fix-button:hover {
  background: var(--accent-hover, #0ea5e9);
  transform: translateY(-1px);
}

.fix-button:active {
  transform: translateY(0);
}

.icon-fix {
  width: 1rem;
  height: 1rem;
}

.help-text {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary, #9ca3af);
  line-height: 1.4;
}
</style>
