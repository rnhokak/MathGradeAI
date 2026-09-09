'use client';

import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageViewerProps {
  images: string[];
  studentName: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ images, studentName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <span>Không có ảnh đính kèm trong bài làm này.</span>
        <span style={{ fontSize: '0.8rem' }}>(Học sinh nộp bài dưới dạng văn bản trực tiếp)</span>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      {/* Control Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(15, 23, 42, 0.9)',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Ảnh bài viết tay ({currentIndex + 1}/{images.length})
        </span>

        {/* Toolbar Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="btn btn-secondary"
                style={{ padding: '6px' }}
                title="Trang trước"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(images.length - 1, prev + 1))}
                disabled={currentIndex === images.length - 1}
                className="btn btn-secondary"
                style={{ padding: '6px' }}
                title="Trang sau"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          <button
            onClick={handleZoomOut}
            className="btn btn-secondary"
            style={{ padding: '6px' }}
            title="Thu nhỏ (-)"
          >
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: '0.78rem', minWidth: '42px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="btn btn-secondary"
            style={{ padding: '6px' }}
            title="Phóng to (+)"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={handleRotate}
            className="btn btn-secondary"
            style={{ padding: '6px' }}
            title="Xoay 90 độ"
          >
            <RotateCw size={15} />
          </button>
          <button
            onClick={handleReset}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            title="Đặt lại góc & tỷ lệ"
          >
            Mặc định
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div
        style={{
          flex: 1,
          minHeight: '520px',
          maxHeight: '750px',
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070b13',
          padding: '16px',
          cursor: zoom > 1 ? 'grab' : 'default',
        }}
      >
        <img
          src={currentImage}
          alt={`Bài làm của ${studentName}`}
          style={{
            maxWidth: '100%',
            height: 'auto',
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          }}
        />
      </div>
    </div>
  );
};
