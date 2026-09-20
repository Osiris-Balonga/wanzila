export default function AdminDashboardLoading() {
  return (
    <div className="admin-page" aria-label="Chargement du tableau de bord" aria-busy="true">
      <div className="admin-loading-header"><span /><span /></div>
      <div className="admin-loading-kpis">{Array.from({ length: 4 }, (_, index) => <span key={index} />)}</div>
      <div className="admin-loading-grid"><span /><span /><span /><span /></div>
    </div>
  )
}
