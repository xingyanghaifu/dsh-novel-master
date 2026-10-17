import type { Context } from '@cordisjs/client'
import ProjectDirectoryInput from './components/ProjectDirectoryInput.vue'

export default (ctx: Context) => {
  // 注册自定义表单组件
  ctx.settings.component('ProjectDirectoryInput', ProjectDirectoryInput)
}
