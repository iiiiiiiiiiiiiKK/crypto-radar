import { Link } from "react-router-dom";
import { Icon } from "@/components/Icons";

export function NotFoundPage() {
  return (
    <main className="page">
      <div className="empty" style={{ minHeight: "60vh" }}>
        <div className="empty__glyph">
          <Icon name="radar" size={34} />
        </div>
        <div className="empty__title">404 · 这个坐标没有信号</div>
        <p className="empty__text">
          页面不存在，或者链接已经过期。回到作战室看看现在市场在做什么。
        </p>
        <div className="row gap-8">
          <Link to="/" className="btn btn--primary">
            返回作战室
          </Link>
          <Link to="/markets" className="btn">
            打开行情表
          </Link>
        </div>
      </div>
    </main>
  );
}
