import type { AssemblySpec, GroupId, PartSpec } from '../model/types'
import { buildBom } from '../model/bom'
import { boundsOf } from '../model/shapes'
import { GROUP_LABELS } from '../model/kinematics'

export interface BomHandlers {
  onSelect(partId: string): void
  onGroupToggle(group: GroupId, visible: boolean): void
}

export const renderBom = (container: HTMLElement, spec: AssemblySpec, handlers: BomHandlers): void => {
  container.replaceChildren()
  for (const row of buildBom(spec)) {
    const groupEl = document.createElement('div')
    groupEl.className = 'bom__group'

    const head = document.createElement('label')
    head.className = 'bom__head'
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.checked = true
    check.addEventListener('change', () => handlers.onGroupToggle(row.group, check.checked))
    const title = document.createElement('span')
    title.textContent = row.groupLabel
    const count = document.createElement('span')
    count.className = 'bom__count'
    count.textContent = `${row.parts.length}`
    head.append(check, title, count)
    groupEl.append(head)

    for (const part of row.parts) {
      const item = document.createElement('button')
      item.className = 'bom__item'
      item.dataset.partId = part.id
      item.textContent = part.name
      item.addEventListener('click', () => handlers.onSelect(part.id))
      groupEl.append(item)
    }
    container.append(groupEl)
  }
}

export const markSelectedInBom = (container: HTMLElement, partId: string | null): void => {
  for (const el of container.querySelectorAll<HTMLElement>('.bom__item')) {
    const selected = el.dataset.partId === partId
    el.classList.toggle('is-selected', selected)
    if (selected) el.scrollIntoView({ block: 'nearest' })
  }
}

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR')

export const renderPartInfo = (container: HTMLElement, part: PartSpec | null): void => {
  const heading = container.querySelector('h2')
  container.replaceChildren(...(heading ? [heading] : []))
  if (!part) {
    const p = document.createElement('p')
    p.className = 'muted'
    p.textContent = '3D 뷰에서 부품을 클릭하거나 목록에서 선택하세요.'
    container.append(p)
    return
  }
  const b = boundsOf(part.shapes)
  const name = document.createElement('p')
  name.className = 'part-info__name'
  name.textContent = part.name
  const group = document.createElement('span')
  group.className = 'part-info__group'
  group.textContent = GROUP_LABELS[part.group]
  const frag: HTMLElement[] = [name, group]
  if (part.description) {
    const desc = document.createElement('p')
    desc.className = 'part-info__desc'
    desc.textContent = part.description
    frag.push(desc)
  }
  const dims = document.createElement('div')
  dims.className = 'part-info__dims'
  dims.textContent = `외형 ${fmt(b.max[0] - b.min[0])} × ${fmt(b.max[1] - b.min[1])} × ${fmt(b.max[2] - b.min[2])} mm · 바닥 높이 ${fmt(b.min[1])}–${fmt(b.max[1])} mm`
  frag.push(dims)
  container.append(...frag)
}

export const renderSpecs = (table: HTMLTableElement, rows: readonly (readonly [string, string])[]): void => {
  table.replaceChildren()
  for (const [k, v] of rows) {
    const tr = document.createElement('tr')
    const td1 = document.createElement('td')
    const td2 = document.createElement('td')
    td1.textContent = k
    td2.textContent = v
    tr.append(td1, td2)
    table.append(tr)
  }
}
