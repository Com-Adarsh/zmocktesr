import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { RegisterForm } from "@/components/register-form";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="hero">
          <div>
            <span className="eyebrow">Entrance exam practice</span>
            <h1>
              Sit the real exam <em>before</em> the real exam.
            </h1>
            <p className="lede">
              Register with the test code from your coordinator, attempt a timed computer-based paper with the same
              palette, review flags and auto-submit as the actual CBT, and see your All-India Rank the moment you submit.
            </p>
            <div className="facts">
              <div>
                <b>CBT</b>
                <span>Question palette &amp; review marks</span>
              </div>
              <div>
                <b>+4 / −1</b>
                <span>Per-test marking scheme</span>
              </div>
              <div>
                <b>Live</b>
                <span>Rank recalculated on submit</span>
              </div>
            </div>
          </div>
          <RegisterForm />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
