import { useId, useMemo } from 'react';

const PATH = {
  perspective: 30,
  cardWidth: 18,
  cardHeight: 25,
  cardRadius: 0.4,
  birthHeight: 2.6,
  exitHeight: 46,
  railBirth: -11,
  railExit: 44,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 28,
  stops: 24
};

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function keyframes(direction, name, path) {
  const steps = [];

  for (let index = 0; index <= path.stops; index += 1) {
    const progress = index / path.stops;
    const scale =
      (path.birthHeight / path.cardHeight) *
      Math.pow(path.exitHeight / path.birthHeight, progress);
    const z = path.perspective * (1 - 1 / scale);
    const rail =
      path.railExit - (path.railExit - path.railBirth) * Math.pow(1 - progress, path.fan);
    const turn = path.turnBirth + (path.turnExit - path.turnBirth) * progress;

    steps.push(
      `${(progress * 100).toFixed(2)}%{transform:translate3d(${(direction * rail).toFixed(2)}cqw,0,${z.toFixed(
        2
      )}cqw) rotateY(${(-direction * turn).toFixed(2)}deg)}`
    );
  }

  return `@keyframes ${name}{${steps.join('')}}`;
}

export function ImageStreamHero({
  images,
  cards = 9,
  speed = 18,
  axis = 55,
  path,
  children,
  className,
  style,
  streamLabel = 'Hiệu ứng ảnh sneaker chuyển động',
  ...props
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const right = `ish-r-${id}`;
  const left = `ish-l-${id}`;
  const card = `ish-c-${id}`;
  const mergedPath = useMemo(() => ({ ...PATH, ...path }), [path]);
  const cardImages = images?.length ? images : [];
  const css = useMemo(
    () =>
      `${keyframes(1, right, mergedPath)}${keyframes(-1, left, mergedPath)}` +
      `@media(prefers-reduced-motion:reduce){.${card}{animation-play-state:paused}}`,
    [right, left, card, mergedPath]
  );

  return (
    <div
      className={cx('image-stream-hero', className)}
      {...props}
      style={{ containerType: 'inline-size', ...style }}
    >
      <style>{css}</style>
      <div
        className="image-stream-layer"
        role="img"
        aria-label={streamLabel}
        style={{
          perspective: `${mergedPath.perspective}cqw`,
          perspectiveOrigin: `50% ${axis}%`
        }}
      >
        <div className="image-stream-stage">
          {[right, left].map((name) =>
            Array.from({ length: cards }, (_, index) => {
              const image = cardImages[index % Math.max(cardImages.length, 1)];
              return (
                <div
                  key={`${name}-${index}`}
                  className={cx(card, 'image-stream-card')}
                  style={{
                    left: '50%',
                    top: `${axis}%`,
                    width: `${mergedPath.cardWidth}cqw`,
                    height: `${mergedPath.cardHeight}cqw`,
                    marginLeft: `${-mergedPath.cardWidth / 2}cqw`,
                    marginTop: `${-mergedPath.cardHeight / 2}cqw`,
                    borderRadius: `${mergedPath.cardRadius}cqw`,
                    animation: `${name} ${speed}s linear infinite`,
                    animationDelay: `${-(index * speed) / cards}s`
                  }}
                >
                  {image ? <img src={image.src} alt="" loading="lazy" decoding="async" draggable={false} /> : null}
                </div>
              );
            })
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export default ImageStreamHero;
