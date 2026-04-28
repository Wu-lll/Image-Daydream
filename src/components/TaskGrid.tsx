import { useMemo, useRef, useState, useEffect } from 'react'
import { useStore, reuseConfig, editOutputs, removeTask } from '../store'
import TaskCard from './TaskCard'

export default function TaskGrid() {
  const tasks = useStore((s) => s.tasks)
  const searchQuery = useStore((s) => s.searchQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const selectedTaskIds = useStore((s) => s.selectedTaskIds)
  const setSelectedTaskIds = useStore((s) => s.setSelectedTaskIds)
  const clearSelection = useStore((s) => s.clearSelection)
  const hasOverlayOpen = useStore((s) =>
    Boolean(s.detailTaskId || s.lightboxImageId || s.showSettings || s.confirmDialog),
  )

  const gridRef = useRef<HTMLDivElement>(null)
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const hasDragged = useRef(false)
  const suppressClickUntil = useRef(0)
  const startedOnCard = useRef(false)
  const startedWithCtrl = useRef(false)
  const initialSelection = useRef<string[]>([])
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  const filteredTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt)
    const q = searchQuery.trim().toLowerCase()

    return sorted.filter((t) => {
      if (filterFavorite && !t.isFavorite) return false
      const matchStatus = filterStatus === 'all' || t.status === filterStatus
      if (!matchStatus) return false

      if (!q) return true
      const prompt = (t.prompt || '').toLowerCase()
      const paramStr = JSON.stringify(t.params).toLowerCase()
      return prompt.includes(q) || paramStr.includes(q)
    })
  }, [tasks, searchQuery, filterStatus, filterFavorite])

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done').length
    const running = tasks.filter((t) => t.status === 'running').length
    const error = tasks.filter((t) => t.status === 'error').length
    return { total: tasks.length, done, running, error }
  }, [tasks])

  const handleDelete = (task: typeof tasks[0]) => {
    setConfirmDialog({
      title: '删除记录',
      message: '确定要删除这条记录吗？关联的图片资源也会被清理（如果没有其他任务引用）。',
      action: () => removeTask(task),
    })
  }

  const renderGridHeader = () => (
    <div className="gallery-heading mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="gallery-title [font-family:var(--font-serif-display)] text-2xl font-medium tracking-normal text-[rgb(29,39,49)]">
          作品墙
        </h2>
        <p className="mt-1 text-xs text-[rgba(102,118,136,0.78)]">
          {stats.total > 0
            ? `当前显示 ${filteredTasks.length} 条，共 ${stats.total} 条作品记录`
            : '作品会按时间安静地留在这里'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[rgba(63,86,110,0.76)]">
        <span className="stat-pill rounded-full border border-[rgba(63,86,110,0.12)] bg-[rgba(248,251,255,0.74)] px-2.5 py-1 shadow-[0_8px_22px_rgba(42,59,77,0.05)]">
          已完成 {stats.done}
        </span>
        {stats.running > 0 && (
          <span className="stat-pill rounded-full border border-[rgba(93,126,163,0.22)] bg-[rgba(225,235,246,0.78)] px-2.5 py-1 text-[rgb(63,92,122)] shadow-[0_8px_22px_rgba(42,59,77,0.05)]">
            生成中 {stats.running}
          </span>
        )}
        {stats.error > 0 && (
          <span className="stat-pill rounded-full border border-[rgba(180,93,90,0.2)] bg-[rgba(180,93,90,0.08)] px-2.5 py-1 text-[rgb(150,75,72)] shadow-[0_8px_22px_rgba(42,59,77,0.05)]">
            失败 {stats.error}
          </span>
        )}
        {selectedTaskIds.length > 0 && (
          <span className="stat-pill rounded-full border border-[rgba(47,57,67,0.16)] bg-[rgba(47,57,67,0.86)] px-2.5 py-1 text-white shadow-[0_8px_22px_rgba(42,59,77,0.1)]">
            已选 {selectedTaskIds.length}
          </span>
        )}
      </div>
    </div>
  )

  const beginSelection = (target: HTMLElement, clientX: number, clientY: number, isCtrl: boolean) => {
    startedOnCard.current = Boolean(target.closest('.task-card-wrapper'))
    startedWithCtrl.current = isCtrl
    initialSelection.current = [...useStore.getState().selectedTaskIds]

    isDragging.current = true
    hasDragged.current = false
    dragStart.current = { x: clientX, y: clientY }
    document.body.classList.add('select-none')
    document.body.classList.add('drag-selecting')
    setSelectionBox({
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
    })
  }

  const updateSelectionFromPoint = (clientX: number, clientY: number) => {
    const start = dragStart.current
    if (!start || !gridRef.current) return

    const minX = Math.min(start.x, clientX)
    const maxX = Math.max(start.x, clientX)
    const minY = Math.min(start.y, clientY)
    const maxY = Math.max(start.y, clientY)

    const cards = gridRef.current.querySelectorAll('.task-card-wrapper')
    const newSelected = new Set(initialSelection.current)
    const initialSelected = new Set(initialSelection.current)

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const taskId = card.getAttribute('data-task-id')
      if (!taskId) return

      const isIntersecting =
        minX < rect.right && maxX > rect.left && minY < rect.bottom && maxY > rect.top

      if (isIntersecting) {
        if (initialSelected.has(taskId)) {
          newSelected.delete(taskId)
        } else {
          newSelected.add(taskId)
        }
      } else if (!initialSelected.has(taskId)) {
        newSelected.delete(taskId)
      }
    })

    setSelectedTaskIds(Array.from(newSelected))
  }

  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      if (hasOverlayOpen) return
      if (e.button !== 0) return
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-input-bar]')) return
      if (target.closest('[data-no-drag-select]')) return
      if (target.closest('button, a, input, textarea, select')) return

      const isCtrl = isMac ? e.metaKey : e.ctrlKey
      beginSelection(target, e.clientX, e.clientY, isCtrl)
    }

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !dragStart.current) return

      const start = dragStart.current
      const distance = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (distance < 6 && !hasDragged.current) return

      hasDragged.current = true
      setSelectionBox({
        startX: start.x,
        startY: start.y,
        currentX: e.clientX,
        currentY: e.clientY,
      })
      updateSelectionFromPoint(e.clientX, e.clientY)
      e.preventDefault()
    }

    const handleDocumentMouseUp = () => {
      if (isDragging.current) {
        document.body.classList.remove('select-none')
        document.body.classList.remove('drag-selecting')
      }
      if (isDragging.current && !hasDragged.current && !startedOnCard.current && !startedWithCtrl.current) {
        clearSelection()
      }
      if (isDragging.current && hasDragged.current) {
        suppressClickUntil.current = Date.now() + 250
      }
      isDragging.current = false
      dragStart.current = null
      setSelectionBox(null)
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    document.addEventListener('mousemove', handleDocumentMouseMove)
    document.addEventListener('mouseup', handleDocumentMouseUp)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      document.removeEventListener('mousemove', handleDocumentMouseMove)
      document.removeEventListener('mouseup', handleDocumentMouseUp)
    }
  }, [clearSelection, hasOverlayOpen, isMac])

  if (!filteredTasks.length) {
    return (
      <>
        {renderGridHeader()}
        <div className="empty-gallery rounded-[2rem] border border-dashed border-[rgba(63,86,110,0.2)] bg-[rgba(248,251,255,0.62)] py-24 text-center text-[rgba(102,118,136,0.82)] shadow-[0_18px_48px_rgba(42,59,77,0.07)] dark:text-gray-500">
          {searchQuery || filterFavorite ? (
            <p className="text-sm">没有找到匹配的记录</p>
          ) : (
            <>
              <svg
                className="w-16 h-16 mx-auto mb-4 text-[rgba(93,126,163,0.24)] dark:text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm font-medium text-[rgb(29,39,49)]">还没有作品。描述一个画面，开始第一张图。</p>
            </>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      {renderGridHeader()}
      <div
        data-task-grid-root
        className="relative min-h-[50vh]"
      >
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
          {filteredTasks.map((task) => (
            <div key={task.id} className="task-card-wrapper" data-task-id={task.id}>
              <TaskCard
                task={task}
                onClick={(e) => {
                  if (Date.now() < suppressClickUntil.current) {
                    e.preventDefault()
                    return
                  }
                  suppressClickUntil.current = 0
                  const isCtrl = isMac ? e.metaKey : e.ctrlKey
                  if (isCtrl) {
                    useStore.getState().toggleTaskSelection(task.id)
                  } else if (selectedTaskIds.length > 0) {
                    clearSelection()
                    setDetailTaskId(task.id)
                  } else {
                    setDetailTaskId(task.id)
                  }
                }}
                onReuse={() => reuseConfig(task)}
                onEditOutputs={() => editOutputs(task)}
                onDelete={() => handleDelete(task)}
                isSelected={selectedTaskIds.includes(task.id)}
              />
            </div>
          ))}
        </div>
        {selectionBox && (
          <div
            className="fixed bg-blue-500/20 border border-blue-500/50 pointer-events-none z-[100]"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.currentX),
              top: Math.min(selectionBox.startY, selectionBox.currentY),
              width: Math.abs(selectionBox.currentX - selectionBox.startX),
              height: Math.abs(selectionBox.currentY - selectionBox.startY),
            }}
          />
        )}
      </div>
    </>
  )
}
