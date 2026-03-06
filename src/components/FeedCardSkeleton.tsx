export default function FeedCardSkeleton() {
    return (
        <div
            className="card"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
            {/* Source + score row */}
            <div className="flex items-center gap-2">
                <div className="skeleton" style={{ width: 80, height: 20 }} />
                <div className="skeleton" style={{ width: 44, height: 20 }} />
            </div>

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skeleton" style={{ width: '92%', height: 18 }} />
                <div className="skeleton" style={{ width: '68%', height: 18 }} />
            </div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div className="skeleton" style={{ width: '100%', height: 13 }} />
                <div className="skeleton" style={{ width: '85%', height: 13 }} />
            </div>

            {/* Footer */}
            <div
                className="flex items-center justify-between pt-2"
                style={{ borderTop: '1px solid var(--border)' }}
            >
                <div className="skeleton" style={{ width: 100, height: 13 }} />
                <div className="skeleton" style={{ width: 64, height: 28, borderRadius: 'var(--radius-sm)' }} />
            </div>
        </div>
    )
}
