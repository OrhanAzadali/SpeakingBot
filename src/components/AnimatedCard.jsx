import { motion } from "motion/react";
export const AnimatedCard = ({
  children,
  className = "",
  delay = 0,
  id
}) => {
  return <motion.div
    id={id}
    initial={{ opacity: 0, y: 32, scale: 0.98 }}
    whileInView={{ opacity: 1, y: 0, scale: 1 }}
    viewport={{ once: false, amount: 0.12, margin: "-24px 0px -24px 0px" }}
    transition={{
      duration: 0.42,
      delay,
      ease: [0.25, 0.1, 0.25, 1]
    }}
    className={className}
  >
      {children}
    </motion.div>;
};
