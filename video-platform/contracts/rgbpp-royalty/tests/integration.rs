// FILE: /video-platform/contracts/rgbpp-royalty/tests/integration.rs
// 测试说明：验证分账输出格式与交易 ID。

use rgbpp_royalty::{distribute, Participant};

#[test]
fn test_distribute() {
    let parts = vec![Participant { address: "a".into(), ratio: 0.9 }, Participant { address: "b".into(), ratio: 0.1 }];
    let (tx, outputs) = distribute("vid1", "1.000000", parts);
    assert!(tx.starts_with("rgbpp-vid1-"));
    assert_eq!(outputs.len(), 2);
    assert_eq!(outputs[0].amount_usdi, "0.900000");
    assert_eq!(outputs[1].amount_usdi, "0.100000");
}