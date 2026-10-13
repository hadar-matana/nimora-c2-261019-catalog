import type {ArrayOfObjectsInputProps} from "sanity";

export function ProductImagesInput(props: ArrayOfObjectsInputProps) {
  return (
    <div>
      <div
        style={{
          border: "1px solid var(--card-border-color)",
          borderRadius: 6,
          marginBottom: "0.75rem",
          padding: "0.75rem"
        }}
      >
        <strong>העלאת תמונות</strong>
        <p style={{margin: "0.35rem 0 0", lineHeight: 1.5}}>
          אפשר לבחור כמה קבצים בבת אחת או לגרור תמונות לשדה. התמונה הראשונה היא התמונה הראשית באתר, וניתן לגרור
          תמונות כדי לשנות סדר או להסיר תמונה מתפריט הפריט.
        </p>
      </div>
      {props.renderDefault(props)}
    </div>
  );
}
