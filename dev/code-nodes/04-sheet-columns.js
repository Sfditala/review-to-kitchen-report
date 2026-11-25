// Only the columns we write back to the sheet. review_id is the match key.
const ISSUE_AR = {
  cold_food: 'أكل بارد', taste_quality: 'طعم/جودة', portion_size: 'الكمية', hygiene: 'نظافة',
  wait_time: 'انتظار', delivery_delay: 'تأخير توصيل', order_accuracy: 'غلط بالطلب',
  packaging: 'تغليف', staff_behavior: 'تعامل الموظفين', price: 'السعر', ambience: 'الأجواء',
  other: 'أخرى', none: 'لا يوجد',
};

return $input.all().map(({ json: r }) => ({
  json: {
    review_id: r.review_id,
    dish: r.dish,
    shift: r.shift,
    issue_type: ISSUE_AR[r.issue_type] || r.issue_type,
    severity: r.severity,
    summary: r.needs_review ? `⚠️ ${r.summary}` : r.summary,
    reply_draft: r.reply_draft,
    classified_at: r.classified_at,
  },
}));
