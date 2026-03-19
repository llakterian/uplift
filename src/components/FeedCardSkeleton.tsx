export default function FeedCardSkeleton() {
    return (
        <div className="x-card">
            <div className="x-card-layout">
                <div className="x-card-content">
                    <div className="x-card-meta">
                        <div className="skeleton" style={{ width: 80, height: 14 }} />
                        <span className="x-dot"></span>
                        <div className="skeleton" style={{ width: 40, height: 14 }} />
                    </div>
                    <div className="skeleton" style={{ width: '90%', height: 16, marginBottom: 4 }} />
                    <div className="skeleton" style={{ width: '60%', height: 16, marginBottom: 6 }} />
                    <div className="skeleton" style={{ width: '100%', height: 12, marginBottom: 3 }} />
                    <div className="skeleton" style={{ width: '75%', height: 12 }} />
                    <div className="x-actions">
                        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                        <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 20, marginLeft: 'auto' }} />
                    </div>
                </div>
                <div className="skeleton x-card-image" />
            </div>
        </div>
    )
}
