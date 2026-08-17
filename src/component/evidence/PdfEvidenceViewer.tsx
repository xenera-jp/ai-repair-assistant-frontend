import { ChevronLeft, ChevronRight, ExternalLink, FileText, LoaderCircle, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
pdfjs.GlobalWorkerOptions.workerSrc = `${pdfWorker}?v=${pdfjs.version}`
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import type { EvidenceItem } from '../../model'

/** 在手册 PDF 中定位并高亮证据来源区域。 */
export function PdfEvidenceViewer({
  source,
}: {
  source: NonNullable<EvidenceItem['sourceDocument']>
}) {
  const { text } = useLanguage()
  const viewerRef = useRef<HTMLDivElement>(null)
  const sourceRegionRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(680)
  const [pageNumber, setPageNumber] = useState(source.pdfPage)
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(1)
  const documentUrl = api.manualDocumentUrl(source.manualKnowledgeId)
  const sourceRegion = source.sourceRegion

  useEffect(() => {
    const container = viewerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      // Reserve a small inner gutter so zooming never clips the PDF shadow.
      setContainerWidth(Math.max(320, entry.contentRect.width - 28))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const focusSourceRegion = () => {
    window.setTimeout(() => {
      sourceRegionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      })
    }, 0)
  }

  const regionStyle = sourceRegion
    ? {
      left: `calc(${(sourceRegion.x / sourceRegion.pageWidth) * 100}% - 4px)`,
      top: `calc(${(sourceRegion.y / sourceRegion.pageHeight) * 100}% - 3px)`,
      width: `calc(${(sourceRegion.width / sourceRegion.pageWidth) * 100}% + 8px)`,
      height: `calc(${(sourceRegion.height / sourceRegion.pageHeight) * 100}% + 6px)`,
    }
    : undefined

  return (
    <section
      className="pdf-evidence-viewer"
      aria-label={text('原始服务手册', '原本サービスマニュアル')}
    >
      <header className="pdf-toolbar">
        <div>
          <FileText size={16} />
          <span>{source.fileName}</span>
        </div>
        <div className="pdf-toolbar-actions">
          <button
            aria-label={text('上一页', '前のページ')}
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            PDF {pageNumber} / {pageCount || '—'}
          </span>
          <button
            aria-label={text('下一页', '次のページ')}
            disabled={pageCount === 0 || pageNumber >= pageCount}
            onClick={() =>
              setPageNumber((current) => Math.min(pageCount, current + 1))
            }
            type="button"
          >
            <ChevronRight size={16} />
          </button>
          <button
            aria-label={text('缩小', '縮小')}
            disabled={zoom <= 0.8}
            onClick={() => setZoom((current) => Math.max(0.8, current - 0.15))}
            type="button"
          >
            <ZoomOut size={16} />
          </button>
          <button
            aria-label={text('放大', '拡大')}
            disabled={zoom >= 1.6}
            onClick={() => setZoom((current) => Math.min(1.6, current + 0.15))}
            type="button"
          >
            <ZoomIn size={16} />
          </button>
          <a
            aria-label={text('在新窗口打开完整手册', '別ウィンドウでマニュアルを開く')}
            href={`${documentUrl}#page=${source.pdfPage}`}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={15} />
          </a>
        </div>
      </header>
      <div className="pdf-location-strip">
        <span>{text('已定位原文', '原文位置')}</span>
        <strong>
          PDF P{source.pdfPage}
          {source.printedPage
            ? ` · ${text('手册', '冊子')} P${source.printedPage}`
            : ''}
          {source.sectionPath ? ` · §${source.sectionPath}` : ''}
          {source.sourceAnchor ? ` · ${source.sourceAnchor}` : ''}
        </strong>
      </div>
      <div className="pdf-page-scroll" ref={viewerRef}>
        <Document
          error={
            <div className="pdf-state">
              {text('原始手册加载失败', '原本マニュアルの読込に失敗しました')}
            </div>
          }
          file={documentUrl}
          loading={
            <div className="pdf-state">
              <LoaderCircle className="spin" size={20} />
              {text('正在读取原始服务手册', '原本サービスマニュアルを読込中')}
            </div>
          }
          onLoadSuccess={({ numPages }) => {
            setPageCount(numPages)
            setPageNumber(Math.min(source.pdfPage, numPages))
          }}
          onLoadError={(error) => {
            console.error('Failed to load the service manual PDF.', error)
          }}
          onSourceError={(error) => {
            console.error('Failed to resolve the service manual PDF source.', error)
          }}
        >
          <div
            className="pdf-page-shell"
            style={{ width: containerWidth * zoom }}
          >
            <Page
              canvasBackground="#ffffff"
              loading={
                <div className="pdf-state">
                  {text('正在渲染证据页', '証拠ページを描画中')}
                </div>
              }
              onRenderSuccess={focusSourceRegion}
              pageNumber={pageNumber}
              renderAnnotationLayer
              renderTextLayer
              width={containerWidth * zoom}
            />
            {pageNumber === source.pdfPage && sourceRegion && (
              <div
                aria-label={`${text('原文定位', '原文位置')}：${source.sourceAnchor}`}
                className="pdf-source-region"
                ref={sourceRegionRef}
                style={regionStyle}
              >
                <span>{text('证据原文', '証拠原文')}</span>
              </div>
            )}
          </div>
        </Document>
      </div>
    </section>
  )
}
