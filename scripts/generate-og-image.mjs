/* 生成社交分享卡片图 public/og-image.jpg（1200x630），从博客横幅裁切 */
import sharp from "sharp";

await sharp("src/assets/images/demo-banner.png")
	.resize(1200, 630, { fit: "cover", position: "attention" })
	.jpeg({ quality: 85 })
	.toFile("public/og-image.jpg");

console.log("og-image generated");
